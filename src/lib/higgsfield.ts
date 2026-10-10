// Higgsfield provider plus one generic generate function driven by the model registry (src/lib/models.ts).
// Confirmed live for Soul 2 only (POST /<endpoint> with `Authorization: Key <key>`, answer carries request_id and
// status_url, poll GET /requests/<id>/status until "completed" with images[0].url). docs.higgsfield.ai is not
// reachable from the build sandbox, so the other models' request bodies are unverified.
import { endpointFor, referenceBody, type ImageModel } from "./models";
import type { ImageProvider, ProviderStatus, SubmitResult } from "./providers/types";

const BASE_URL = process.env.HIGGSFIELD_BASE_URL ?? "https://platform.higgsfield.ai";
const MAX_CONCURRENT = 20; // the key allows about 20 in flight; extra renders wait their turn instead of failing

type JobResponse = {
  status?: string;
  request_id?: string;
  status_url?: string;
  images?: { url: string }[];
  image?: { url: string };
  cost?: number;
  error?: string;
};

// Carries Higgsfield's own reply so the route can tell the user what was rejected.
export class HiggsfieldError extends Error {
  constructor(message: string, readonly detail?: string) { super(message); }
}

function headers(extra: Record<string, string> = {}) {
  const key = process.env.HIGGSFIELD_API_KEY;
  if (!key) throw new Error("HIGGSFIELD_API_KEY is not set");
  return { "Content-Type": "application/json", Accept: "application/json", Authorization: `Key ${key}`, ...extra };
}

const urlOf = (job: JobResponse) => job.images?.[0]?.url ?? job.image?.url;

// Per-instance queue: serverless instances do not share it, so this only smooths bursts on one instance.
let inFlight = 0;
const waiting: (() => void)[] = [];
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_CONCURRENT) await new Promise<void>((resolve) => waiting.push(resolve));
  inFlight++;
  try { return await fn(); } finally { inFlight--; waiting.shift()?.(); }
}

export const higgsfield: ImageProvider = {
  async submit(endpoint, body, idempotencyKey): Promise<SubmitResult> {
    // The same key on a retry means Higgsfield never charges twice for one render.
    const send = () => fetch(`${BASE_URL}/${endpoint}`, { method: "POST", headers: headers({ "Idempotency-Key": idempotencyKey }), body: JSON.stringify(body) });
    const attempt = async () => {
      try { return await send(); } catch (e) {
        const why = e instanceof Error ? `${e.name}: ${e.message}` : "network error";
        throw new HiggsfieldError(`Higgsfield could not be reached for ${endpoint}: ${why}`, `could not reach Higgsfield (${why.slice(0, 120)})`);
      }
    };
    let res: Response;
    try { res = await attempt(); } catch { res = await attempt(); }
    if (res.status >= 500) res = await attempt();
    if (!res.ok) {
      const text = await res.text();
      throw new HiggsfieldError(`Higgsfield request failed (${res.status}) for ${endpoint}: ${text}`, `${res.status}: ${text.slice(0, 200)}`);
    }
    const text = await res.text();
    let job: JobResponse | null = null;
    try { job = JSON.parse(text) as JobResponse; } catch {}
    if (!job) throw new HiggsfieldError(`Higgsfield sent an unreadable reply for ${endpoint}: ${text.slice(0, 300)}`, `the reply was not readable (${res.status}): ${text.slice(0, 160)}`);
    if (!job.request_id && !job.status_url) throw new HiggsfieldError(`Higgsfield returned no request id for ${endpoint}: ${text.slice(0, 300)}`, `the reply had no request id: ${text.slice(0, 200)}`);
    return { requestId: job.request_id ?? "", statusUrl: job.status_url ?? `${BASE_URL}/requests/${job.request_id}/status` };
  },

  async status(statusUrl): Promise<ProviderStatus> {
    const res = await fetch(statusUrl, { headers: headers() });
    if (!res.ok) throw new Error(`Higgsfield status check failed (${res.status})`);
    const job = (await res.json()) as JobResponse;
    const imageUrl = urlOf(job);
    if (imageUrl) return { state: "completed", imageUrl };
    if (["failed", "nsfw", "canceled", "cancelled"].includes(job.status ?? "")) return { state: "failed", reason: job.status ?? "failed", detail: typeof job.error === "string" ? job.error : undefined };
    return { state: "pending" };
  },

  async cancel(requestId) {
    await fetch(`${BASE_URL}/requests/${requestId}/cancel`, { method: "POST", headers: headers() });
  },
};

export type GenerateInput = { model: ImageModel; prompt: string; aspectRatio?: string; resolution?: string; references?: string[]; seed?: number };

// Starts a render on the model's own endpoint and returns at once; never substitutes another model. The render keeps
// running at Higgsfield whether or not anyone is watching, and is picked up later with higgsfield.status(statusUrl).
export async function startGeneration(input: GenerateInput, provider: ImageProvider = higgsfield): Promise<SubmitResult> {
  const { model, prompt, aspectRatio } = input;
  const resolution = input.resolution ?? model.defaultResolution;
  const body = { ...model.extraBody, prompt, ...(resolution ? { resolution } : {}), ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}), ...referenceBody(model, input.references ?? []), ...(input.seed != null && model.seed.supported ? { seed: input.seed } : {}) };
  return withSlot(() => provider.submit(endpointFor(model), body, crypto.randomUUID()));
}

// Hands one picture to Higgsfield's own file storage and returns the public https address to use in a request.
// Per Higgsfield's file-upload page: ask for an upload slot (we authenticate), then PUT the bytes to the slot's address with
// exactly the headers it names. Our credentials are never sent to that storage address. The slot lasts an hour.
// HIGGSFIELD_FILES_URL overrides the slot endpoint (default: <base>/files/generate-upload-url).
export async function uploadFile(bytes: Uint8Array, contentType: string): Promise<string> {
  const slotUrl = process.env.HIGGSFIELD_FILES_URL ?? `${BASE_URL}/files/generate-upload-url`;
  const slotRes = await fetch(slotUrl, { method: "POST", headers: headers(), body: JSON.stringify({ content_type: contentType }), signal: AbortSignal.timeout(15_000) });
  if (!slotRes.ok) throw new Error(`Higgsfield upload slot failed (${slotRes.status})`);
  const slot = (await slotRes.json()) as { upload_url?: string; upload_headers?: Record<string, string>; public_url?: string };
  if (!slot.upload_url || !slot.public_url || !slot.public_url.startsWith("https://")) throw new Error("Higgsfield returned an unreadable upload slot");
  const put = await fetch(slot.upload_url, { method: "PUT", headers: { "Content-Type": contentType, ...(slot.upload_headers ?? {}) }, body: bytes as unknown as BodyInit, signal: AbortSignal.timeout(30_000) });
  if (!put.ok) throw new Error(`Higgsfield file upload failed (${put.status})`);
  return slot.public_url;
}
