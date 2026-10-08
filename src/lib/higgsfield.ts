// Higgsfield provider plus one generic generate function driven by the model registry (src/lib/models.ts).
// Confirmed live for Soul 2 only (POST /<endpoint> with `Authorization: Key <key>`, answer carries request_id and
// status_url, poll GET /requests/<id>/status until "completed" with images[0].url). docs.higgsfield.ai is not
// reachable from the build sandbox, so the other models' request bodies are unverified.
import { endpointFor, type ImageModel } from "./models";
import type { ImageProvider, ProviderStatus, SubmitResult } from "./providers/types";

const BASE_URL = process.env.HIGGSFIELD_BASE_URL ?? "https://platform.higgsfield.ai";
const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 55_000;
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    let res = await send().catch(() => null);
    if (!res || res.status >= 500) res = await send();
    if (!res.ok) {
      const text = await res.text();
      throw new HiggsfieldError(`Higgsfield request failed (${res.status}) for ${endpoint}: ${text}`, `${res.status}: ${text.slice(0, 200)}`);
    }
    const job = (await res.json()) as JobResponse;
    if (!job.request_id && !job.status_url) throw new Error("Higgsfield returned no request id");
    return { requestId: job.request_id ?? "", statusUrl: job.status_url ?? `${BASE_URL}/requests/${job.request_id}/status` };
  },

  async status(statusUrl): Promise<ProviderStatus> {
    const res = await fetch(statusUrl, { headers: headers() });
    if (!res.ok) throw new Error(`Higgsfield status check failed (${res.status})`);
    const job = (await res.json()) as JobResponse;
    const imageUrl = urlOf(job);
    if (imageUrl) return { state: "completed", imageUrl };
    if (["failed", "nsfw", "canceled", "cancelled"].includes(job.status ?? "")) return { state: "failed", reason: job.status ?? "failed" };
    return { state: "pending" };
  },

  async cancel(requestId) {
    await fetch(`${BASE_URL}/requests/${requestId}/cancel`, { method: "POST", headers: headers() });
  },
};

export type GenerateInput = { model: ImageModel; prompt: string; aspectRatio?: string; resolution?: string };
export type GenerateResult = { imageUrl: string; requestId: string };

// Submits to the model's own endpoint, waits for the result, and never substitutes another model.
export async function generateImage(input: GenerateInput, provider: ImageProvider = higgsfield): Promise<GenerateResult> {
  const { model, prompt, aspectRatio } = input;
  const resolution = input.resolution ?? model.defaultResolution;
  const body = { prompt, ...(resolution ? { resolution } : {}), ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}) };

  return withSlot(async () => {
    const { requestId, statusUrl } = await provider.submit(endpointFor(model), body, crypto.randomUUID());
    const deadline = Date.now() + TIMEOUT_MS;
    for (;;) {
      const s = await provider.status(statusUrl);
      if (s.state === "completed") return { imageUrl: s.imageUrl, requestId };
      if (s.state === "failed") throw new Error(`Higgsfield generation ${s.reason}`);
      if (Date.now() > deadline) {
        await provider.cancel(requestId).catch(() => {});
        throw new Error("Higgsfield generation timed out");
      }
      await sleep(POLL_INTERVAL_MS);
    }
  });
}
