// Video through Higgsfield: submit a job, ask how it is going, cancel it. Videos take minutes, so nothing waits: the caller stores the request id and the two
// addresses Higgsfield returns, and asks again (see src/lib/video-jobs.ts). Same account, key and idempotency rule as the image provider (src/lib/higgsfield.ts).
// Media inputs in the body must be public https addresses (never asset:// references).
import { BASE_URL, HiggsfieldError, headers } from "./higgsfield";
import { arkCancel, arkStatus, isArkUrl } from "./providers/byteplus-video";

// Where video requests go. The default is the same address the image requests already use; the Higgsfield docs name https://api.higgsfield.ai, so set
// HIGGSFIELD_VIDEO_BASE_URL to that if the default does not serve video. Status and cancel addresses come back from Higgsfield itself and may be on either host.
const VIDEO_BASE = process.env.HIGGSFIELD_VIDEO_BASE_URL ?? BASE_URL;
const HOSTS = new Set([BASE_URL, VIDEO_BASE, "https://api.higgsfield.ai", "https://platform.higgsfield.ai"].map((u) => new URL(u).origin));

// The key goes with these requests, so it only ever goes to Higgsfield's own hosts.
function checked(url: string): string {
  const u = new URL(url);
  if (u.protocol !== "https:" || !HOSTS.has(u.origin)) throw new Error("Refusing a provider address outside Higgsfield's hosts");
  return url;
}

export type VideoSubmit = { requestId: string; statusUrl: string; cancelUrl: string | null };
export type VideoStatus =
  | { state: "queued"; raw?: string }
  | { state: "in_progress"; raw?: string }
  | { state: "completed"; videoUrl: string; usage?: Record<string, unknown> }
  | { state: "failed"; detail?: string }
  | { state: "nsfw"; detail?: string }
  | { state: "canceled" };

type Job = { status?: string; request_id?: string; status_url?: string; cancel_url?: string; video?: { url?: string }; videos?: { url?: string }[]; error?: unknown };

// POST /<endpoint>. One retry with the SAME Idempotency-Key after a network failure or a 5xx (so the same attempt can never be billed twice); a 4xx is never retried.
export async function submitVideo(endpoint: string, body: Record<string, unknown>, idempotencyKey: string): Promise<VideoSubmit> {
  const send = () => fetch(`${VIDEO_BASE}/${endpoint}`, { method: "POST", headers: headers({ "Idempotency-Key": idempotencyKey }), body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  const attempt = async (): Promise<Response> => {
    try { return await send(); } catch (e) {
      const why = e instanceof Error ? `${e.name}: ${e.message}` : "network error";
      throw new HiggsfieldError(`Higgsfield could not be reached for ${endpoint}: ${why}`, `could not reach Higgsfield (${why.slice(0, 120)})`);
    }
  };
  let res: Response;
  try { res = await attempt(); } catch { res = await attempt(); }
  if (res.status >= 500) res = await attempt();
  const text = await res.text();
  if (!res.ok) throw new HiggsfieldError(`Higgsfield video request failed (${res.status}) for ${endpoint}: ${text}`, `${res.status}: ${text.slice(0, 300)}`, res.status);
  let job: Job | null = null;
  try { job = JSON.parse(text) as Job; } catch {}
  if (!job || (!job.request_id && !job.status_url)) throw new HiggsfieldError(`Higgsfield returned no request id for ${endpoint}: ${text.slice(0, 300)}`, `the reply had no request id: ${text.slice(0, 200)}`, res.status);
  return { requestId: job.request_id ?? "", statusUrl: job.status_url ?? `${VIDEO_BASE}/requests/${job.request_id}/status`, cancelUrl: job.cancel_url ?? (job.request_id ? `${VIDEO_BASE}/requests/${job.request_id}/cancel` : null) };
}

// GET status_url once. Stop asking on completed, failed, nsfw or canceled.
export async function videoStatus(statusUrl: string): Promise<VideoStatus> {
  if (isArkUrl(statusUrl)) return arkStatus(statusUrl); // a job started on the direct BytePlus route
  const res = await fetch(checked(statusUrl), { headers: headers(), signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Higgsfield status check failed (${res.status})`);
  const job = (await res.json()) as Job;
  const status = (job.status ?? "").toLowerCase();
  const url = job.video?.url ?? job.videos?.[0]?.url;
  if (status === "completed") return url ? { state: "completed", videoUrl: url } : { state: "failed", detail: "the provider reported the video done but sent no file" };
  if (status === "failed") return { state: "failed", detail: typeof job.error === "string" ? job.error : undefined };
  if (status === "nsfw") return { state: "nsfw" };
  if (status === "canceled" || status === "cancelled") return { state: "canceled" };
  if (status === "in_progress") return { state: "in_progress", raw: status };
  // Anything not recognised is treated as still waiting, but its exact word is kept (and logged) so a status we misread shows up instead of looking like a stuck job.
  if (status !== "queued") console.warn("video status not recognised, treated as queued:", JSON.stringify(status));
  return { state: "queued", raw: status || "(empty)" };
}

// What cancel really does is NOT VERIFIED (the pages list the address but not its behavior): best effort. Returns whether Higgsfield accepted the call.
export async function cancelVideo(cancelUrl: string): Promise<boolean> {
  if (isArkUrl(cancelUrl)) return arkCancel(cancelUrl);
  try {
    const res = await fetch(checked(cancelUrl), { method: "POST", headers: headers(), signal: AbortSignal.timeout(20_000) });
    return res.ok;
  } catch { return false; }
}
