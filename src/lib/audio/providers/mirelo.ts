import { mapMireloError, NETWORK_ERROR, TIMEOUT_ERROR } from "../errors";
import { ProviderFailure, type AudioProvider, type AudioRequest, type AudioResult, type ProviderCtx, type ProviderError } from "../types";
import { EMPTY_AUDIO, send } from "./http";

// Mirelo (docs/audio-providers/mirelo.md): sound effects from text and sound made FOR a video, one async job per request. Plain fetch, /v3 routes only.
//   create    POST /v3/text-to-sfx/generations?wait=25   or   /v3/video-to-sfx/generations?wait=25   (202 = still running; poll `urls.self`)
//   quote     the same path + /preflight (no charge)
//   poll      GET urls.self; the HTTP status is 200 even for a failed job, so branch on `status` (and on each variant's own status)
// The result field names are NOT VERIFIED (the OpenAPI file could not be fetched): audio addresses are collected defensively from `result`, and the real shape must be
// checked with a real key. Downloads may redirect to storage: the key is never sent to the redirect target.

const MODELS = new Set(["sfx-2.0"]);
const MIME: Record<string, string> = { wav: "audio/wav", flac: "audio/flac", mp3_128: "audio/mpeg", mp3_192: "audio/mpeg", mp3_256: "audio/mpeg", mp3_320: "audio/mpeg" };
const WAIT_SECONDS = 25; // the longest the API holds a create open (1 to 25)

const headers = (ctx: ProviderCtx, extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${ctx.apiKey}`, "Content-Type": "application/json", ...extra });
const pathFor = (req: AudioRequest) => (req.kind === "vsfx" ? "/v3/video-to-sfx/generations" : "/v3/text-to-sfx/generations");

/** The exact create body (golden-tested). `duration_ms` is whole milliseconds. */
export function mireloBody(req: AudioRequest): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  if (req.text) input.prompt = req.text;
  if (req.kind === "sfx" && req.negativePrompt) input.negative_prompt = req.negativePrompt;
  if (req.kind === "vsfx" && req.videoUrl) input.video = { type: "url", url: req.videoUrl };
  const body: Record<string, unknown> = { model: req.modelId, num_variants: Math.min(4, Math.max(1, Math.floor(req.variants ?? 1))), input, output: { format: req.outputFormat ?? "wav" } };
  if (req.durationSec != null) body.duration_ms = Math.round(req.durationSec * 1000);
  if (req.kind === "vsfx") body.controls = { preserve_speech: req.preserveSpeech !== false };
  return body;
}

type Job = { id?: unknown; job_id?: unknown; status?: unknown; credits?: unknown; urls?: { self?: unknown }; result?: unknown; outputs?: unknown; errors?: unknown; error?: unknown };
const asJob = (j: unknown): Job => (j && typeof j === "object" ? (j as Job) : {});
const idOf = (j: Job) => (typeof j.id === "string" ? j.id : typeof j.job_id === "string" ? j.job_id : "");

// Finds the finished audio items wherever the answer keeps them: objects that carry an address, each with its own status (a variant can fail on its own).
type Item = { url: string; status?: string; contentType?: string };
export function collectItems(node: unknown, depth = 0, out: Item[] = []): Item[] {
  if (!node || typeof node !== "object" || depth > 5 || out.length >= 8) return out;
  if (Array.isArray(node)) { for (const n of node) collectItems(n, depth + 1, out); return out; }
  const o = node as Record<string, unknown>;
  if (typeof o.url === "string" && /^https?:\/\//i.test(o.url)) {
    out.push({ url: o.url, status: typeof o.status === "string" ? o.status.toLowerCase() : undefined, contentType: typeof o.content_type === "string" ? o.content_type : undefined });
    return out;
  }
  for (const v of Object.values(o)) collectItems(v, depth + 1, out);
  return out;
}

function failureOf(j: Job): ProviderError {
  const first = Array.isArray(j.errors) ? j.errors[0] : j.error;
  const body = JSON.stringify({ error: first && typeof first === "object" ? first : {} });
  const e = mapMireloError(422, body);
  return e.code === "invalid_request" && !(first && typeof first === "object" && "code" in first)
    ? { retryable: false, code: "job_failed", userMessage: "The sound could not be made. Nothing was charged." }
    : { ...e, retryable: false, userMessage: `${e.userMessage} Nothing was charged.` };
}

// One download. The key goes only to Mirelo's own host, and never to wherever it redirects.
async function fetchAudio(ctx: ProviderCtx, url: string): Promise<Uint8Array> {
  let target = url;
  for (let hop = 0; hop < 4; hop++) {
    const u = new URL(target);
    const base = new URL(ctx.baseUrl);
    const own = u.origin === base.origin;
    // https only; plain http is allowed only when the configured base address is itself http (a local test server), never in production.
    if (u.protocol !== "https:" && !(base.protocol === "http:" && u.hostname === base.hostname)) throw new ProviderFailure(EMPTY_AUDIO);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 120_000);
    let res: Response;
    try { res = await fetch(target, { method: "GET", redirect: "manual", headers: own ? { Authorization: `Bearer ${ctx.apiKey}` } : {}, signal: ctl.signal }); }
    catch (err) { throw new ProviderFailure(err instanceof Error && err.name === "AbortError" ? TIMEOUT_ERROR : NETWORK_ERROR); }
    finally { clearTimeout(timer); }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) { target = new URL(res.headers.get("location")!, target).toString(); continue; }
    if (!res.ok) throw new ProviderFailure({ retryable: res.status >= 500 || res.status === 429, code: `download_${res.status}`, userMessage: EMPTY_AUDIO.userMessage });
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length) throw new ProviderFailure(EMPTY_AUDIO);
    return bytes;
  }
  throw new ProviderFailure(EMPTY_AUDIO);
}

const sameHost = (ctx: ProviderCtx, url: string) => { try { return new URL(url).origin === new URL(ctx.baseUrl).origin; } catch { return false; } };

export const mirelo: AudioProvider = {
  id: "mirelo",
  supports: (kind, modelId) => (kind === "sfx" || kind === "vsfx") && MODELS.has(modelId),

  // Quote without charging. The answer's field is not in our reference: `credits` is read, then `cost.credits`, then `quote.credits` (VERIFY with a real key).
  async preflight(req: AudioRequest, ctx: ProviderCtx): Promise<{ credits: number | null }> {
    const res = await send("mirelo", ctx, `${ctx.baseUrl}${pathFor(req)}/preflight`, { method: "POST", headers: headers(ctx), body: JSON.stringify(mireloBody(req)) }, mapMireloError, 15_000);
    const j = (await res.json().catch(() => null)) as { credits?: unknown; cost?: { credits?: unknown }; quote?: { credits?: unknown } } | null;
    const n = [j?.credits, j?.cost?.credits, j?.quote?.credits].find((x) => typeof x === "number" && Number.isFinite(x));
    return { credits: typeof n === "number" ? n : null };
  },

  async start(req: AudioRequest, ctx: ProviderCtx): Promise<{ taskId: string; pollUrl?: string }> {
    const extra: Record<string, string> = req.idempotencyKey ? { "Idempotency-Key": req.idempotencyKey } : {};
    const res = await send("mirelo", ctx, `${ctx.baseUrl}${pathFor(req)}?wait=${WAIT_SECONDS}`, { method: "POST", headers: headers(ctx, extra), body: JSON.stringify(mireloBody(req)) }, mapMireloError, (WAIT_SECONDS + 20) * 1000);
    const j = asJob(await res.json().catch(() => null));
    const id = idOf(j);
    const self = typeof j.urls?.self === "string" ? j.urls.self : undefined;
    if (!id || !self || !sameHost(ctx, self)) throw new ProviderFailure({ retryable: true, code: "empty_task", userMessage: "The sound could not be started right now. Please try again in a moment." });
    return { taskId: id, pollUrl: self };
  },

  async poll(taskId: string, ctx: ProviderCtx, pollUrl?: string) {
    if (!pollUrl || !sameHost(ctx, pollUrl)) return { status: "failed" as const, error: { retryable: false, code: "bad_task", userMessage: "The sound could not be made. Nothing was charged." } };
    const res = await send("mirelo", ctx, pollUrl, { method: "GET", headers: { Authorization: `Bearer ${ctx.apiKey}` } }, mapMireloError, 30_000);
    const j = asJob(await res.json().catch(() => null));
    const status = typeof j.status === "string" ? j.status.toLowerCase() : "";
    if (status === "failed" || status === "canceled" || status === "expired") return { status: "failed" as const, error: failureOf(j) };
    if (status !== "succeeded" && status !== "partially_succeeded") return { status: "running" as const };
    // Every variant has its own status: only the ones that succeeded are kept (the rest is not charged).
    const good = collectItems(j.result ?? j.outputs).filter((i) => !i.status || i.status === "succeeded");
    if (!good.length) return { status: "failed" as const, error: { retryable: false, code: "no_audio", userMessage: "The sound could not be made. Nothing was charged." } };
    const variants: NonNullable<AudioResult["variants"]> = [];
    for (const item of good) {
      const bytes = await fetchAudio(ctx, item.url);
      variants.push({ bytes, mime: item.contentType && /^audio\//.test(item.contentType) ? item.contentType.replace("audio/x-wav", "audio/wav") : MIME[/\.(wav|flac)(\?|$)/i.exec(item.url)?.[1]?.toLowerCase() ?? ""] ?? "audio/mpeg" });
    }
    const credits = typeof j.credits === "number" && Number.isFinite(j.credits) ? j.credits : undefined;
    return { status: "done" as const, result: { bytes: variants[0].bytes, mime: variants[0].mime, variants, usage: { variants: variants.length, ...(credits != null ? { credits } : {}) } } };
  },

  // Never called: Mirelo jobs always run through start/poll. Kept so the interface is complete.
  async generate(): Promise<AudioResult> { throw new ProviderFailure({ retryable: false, code: "async_only", userMessage: "The sound could not be made right now." }); },
};
