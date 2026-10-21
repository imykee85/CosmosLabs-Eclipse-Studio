// BytePlus ModelArk video (Seedance 2.0 and 2.5) as a DIRECT route, built from the owner's reference pages (docs/video-providers/byteplus-seedance-25.md):
// POST <base>/contents/generations/tasks {model, content[], ...} -> {id}; GET .../tasks/{id} -> status queued|running|succeeded|failed|expired, the finished
// file at content.video_url (kept 24 hours), tokens in usage; DELETE .../tasks/{id} cancels a queued task. Same host and `Authorization: Bearer` key as
// Seedream (ARK_API_KEY). NOT run against the live API (the sandbox cannot reach it): the request shape follows BytePlus' own samples.
// The body is made from the SAME validated body the Higgsfield endpoint would get (video-models.ts buildVideoBody), so every rule is checked once.
import type { VideoStatus } from "../higgsfield-video";

const base = () => (process.env.ARK_BASE_URL ?? "https://ark.ap-southeast.bytepluses.com/api/v3").replace(/\/$/, "");
export function isArkUrl(url: string): boolean {
  try { return new URL(url).origin === new URL(base()).origin; } catch { return false; }
}

export type ArkWorkflow = "t2v" | "i2v" | "ref" | "edit" | "extend";

// Eclipse model id -> BytePlus model id (ARK_VIDEO_MODEL_<ID> overrides, a Config value, in case BytePlus issues a new dated version).
const MODELS: Record<string, string> = { seedance_2_5: "dreamina-seedance-2-5-260628", seedance_2_0: "dreamina-seedance-2-0-260128" };
export const hasArkVideo = (modelId: string) => modelId in MODELS;
export const arkVideoModel = (modelId: string) => process.env[`ARK_VIDEO_MODEL_${modelId.toUpperCase()}`]?.trim() || MODELS[modelId];

type Item = Record<string, unknown>;
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

// The Higgsfield-shaped body (prompt, duration, resolution, aspect_ratio, generate_audio, seed, image_url, end_image_url, image_urls, video_urls, audio_urls,
// video_url) turned into BytePlus' content list.
export function arkVideoBody(modelId: string, workflow: ArkWorkflow, hf: Record<string, unknown>): Record<string, unknown> {
  const content: Item[] = [];
  const prompt = typeof hf.prompt === "string" ? hf.prompt.trim() : "";
  if (prompt) content.push({ type: "text", text: prompt });
  const image = (url: string, role: string): Item => ({ type: "image_url", image_url: { url }, role });
  if (workflow === "i2v") {
    if (typeof hf.image_url === "string") content.push(image(hf.image_url, "first_frame"));
    if (typeof hf.end_image_url === "string") content.push(image(hf.end_image_url, "last_frame"));
  }
  if (workflow === "edit" || workflow === "extend") {
    if (typeof hf.video_url === "string") content.push({ type: "video_url", video_url: { url: hf.video_url }, role: "reference_video" });
  }
  for (const u of strings(hf.image_urls)) content.push(image(u, "reference_image"));
  for (const u of strings(hf.video_urls)) content.push({ type: "video_url", video_url: { url: u }, role: "reference_video" });
  for (const u of strings(hf.audio_urls)) content.push({ type: "audio_url", audio_url: { url: u }, role: "reference_audio" });
  const body: Record<string, unknown> = { model: arkVideoModel(modelId), content, watermark: false };
  if (typeof hf.generate_audio === "boolean") body.generate_audio = hf.generate_audio;
  if (typeof hf.resolution === "string") body.resolution = hf.resolution;
  // A start frame, Edit and Extend keep the shape of their input: BytePlus only accepts "adaptive" there (Seedance 2.5). Edit keeps the length too (-1).
  body.ratio = workflow === "i2v" || workflow === "edit" || workflow === "extend" ? "adaptive" : typeof hf.aspect_ratio === "string" ? hf.aspect_ratio : "adaptive";
  body.duration = workflow === "edit" ? -1 : typeof hf.duration === "number" ? hf.duration : -1;
  if (typeof hf.seed === "number") body.seed = hf.seed;
  if (modelId === "seedance_2_5" && (workflow === "ref" || workflow === "edit" || workflow === "extend")) body.omni_reference_task_type = workflow === "ref" ? "reference" : workflow;
  return body;
}

export class ArkError extends Error {
  // `ambiguous`: BytePlus may already have started the job (a timeout, or a reply we could not read). Then NOTHING is retried on another route, or the
  // person could pay twice; the start simply fails and the hold is released.
  constructor(message: string, readonly detail: string, readonly status?: number, readonly ambiguous = false) { super(message); }
}

const NOT_SENT = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"]);
const headers = (key: string) => ({ "Content-Type": "application/json", Authorization: `Bearer ${key}` });
const keyOrThrow = () => { const k = process.env.ARK_API_KEY; if (!k) throw new ArkError("BytePlus key missing", "ARK_API_KEY is not set"); return k; };

export async function submitArk(body: Record<string, unknown>): Promise<{ taskId: string; statusUrl: string }> {
  const key = keyOrThrow();
  let res: Response;
  try {
    res = await fetch(`${base()}/contents/generations/tasks`, { method: "POST", headers: headers(key), body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  } catch (e) {
    const code = (e as { cause?: { code?: string } }).cause?.code;
    throw new ArkError("BytePlus could not be reached", `could not reach BytePlus (${e instanceof Error ? e.message : "network error"})`, undefined, !(code && NOT_SENT.has(code)));
  }
  const text = await res.text();
  if (!res.ok) throw new ArkError(`BytePlus refused the video (${res.status})`, `${res.status}: ${text.slice(0, 300)}`, res.status, false);
  let id: unknown;
  try { id = (JSON.parse(text) as { id?: unknown }).id; } catch {}
  if (typeof id !== "string" || !id) throw new ArkError("BytePlus sent no task id", `the reply had no task id: ${text.slice(0, 200)}`, res.status, true);
  return { taskId: id, statusUrl: `${base()}/contents/generations/tasks/${encodeURIComponent(id)}` };
}

type Task = { status?: string; content?: { video_url?: string }; error?: { code?: string; message?: string } | string; usage?: Record<string, unknown> };
export async function arkStatus(statusUrl: string): Promise<VideoStatus> {
  const res = await fetch(statusUrl, { headers: headers(keyOrThrow()), signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`BytePlus status check failed (${res.status})`);
  const job = (await res.json()) as Task;
  const status = (job.status ?? "").toLowerCase();
  const detail = typeof job.error === "string" ? job.error : job.error ? `${job.error.code ?? ""} ${job.error.message ?? ""}`.trim() : undefined;
  if (status === "succeeded") return job.content?.video_url ? { state: "completed", videoUrl: job.content.video_url, usage: job.usage } : { state: "failed", detail: "the provider reported the video done but sent no file" };
  if (status === "failed") return { state: "failed", detail };
  if (status === "expired") return { state: "failed", detail: "the task expired at the provider" };
  if (status === "cancelled" || status === "canceled") return { state: "canceled" };
  if (status === "running") return { state: "in_progress", raw: status };
  if (status !== "queued") console.warn("BytePlus video status not recognised, treated as queued:", JSON.stringify(status));
  return { state: "queued", raw: status || "(empty)" };
}

// DELETE cancels a queued task; a running one cannot be stopped (best effort, the caller asks the status again).
export async function arkCancel(url: string): Promise<boolean> {
  try { return (await fetch(url, { method: "DELETE", headers: headers(keyOrThrow()), signal: AbortSignal.timeout(20_000) })).ok; } catch { return false; }
}
