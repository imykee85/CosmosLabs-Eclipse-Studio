import type { ProviderError } from "./types";

// Turns a provider's failure into one shape (docs/audio-providers/build-brief.md section 2). The raw provider text is for the server log only.
const GENERIC = "The voice could not be made right now. Please try again in a moment.";
const UNAVAILABLE = "Voice generation is unavailable right now.";

function parseDetail(body: string): { code?: string; message?: string; status?: string } {
  try {
    const j = JSON.parse(body) as { detail?: unknown };
    const d = j?.detail;
    if (typeof d === "string") return { message: d };
    if (Array.isArray(d)) return { code: "validation_error", message: d.map((x) => (x && typeof x === "object" && "msg" in x ? String((x as { msg: unknown }).msg) : "")).filter(Boolean).join("; ") };
    if (d && typeof d === "object") { const o = d as { code?: unknown; message?: unknown; status?: unknown }; return { code: typeof o.code === "string" ? o.code : undefined, message: typeof o.message === "string" ? o.message : undefined, status: typeof o.status === "string" ? o.status : undefined }; }
  } catch { /* not JSON */ }
  return {};
}

// ElevenLabs: branch on `detail.code` (the legacy `status` is ignored), then on the HTTP status.
export function mapElevenLabsError(status: number, body: string): ProviderError {
  const d = parseDetail(body);
  const code = d.code ?? d.status ?? `http_${status}`;
  const pc = d.code ?? status;
  if (code === "system_busy" || code === "concurrent_limit_exceeded" || code === "rate_limit_exceeded" || status === 429) return { retryable: true, code: code === `http_${status}` ? "rate_limited" : code, providerCode: pc, userMessage: "The voice service is busy. Please try again in a moment." };
  if (status >= 500 || code === "service_unavailable" || code === "maintenance") return { retryable: true, code: code === `http_${status}` ? "provider_unavailable" : code, providerCode: pc, userMessage: GENERIC };
  if (code === "insufficient_credits" || status === 402) return { retryable: false, alert: true, code: "insufficient_credits", providerCode: pc, userMessage: UNAVAILABLE };
  if (status === 401 || code === "authentication_error") return { retryable: false, alert: true, code: "auth", providerCode: pc, userMessage: UNAVAILABLE };
  if (code === "voice_access_denied") return { retryable: false, code, providerCode: pc, userMessage: "This voice can't be used with the current account. Pick another voice." };
  if (status === 403 || code === "authorization_error" || code === "feature_not_available" || code === "subscription_required" || code === "model_access_denied") return { retryable: false, alert: true, code: code === `http_${status}` ? "forbidden" : code, providerCode: pc, userMessage: UNAVAILABLE };
  if (code === "voice_not_found" || code === "invalid_voice_id") return { retryable: false, code, providerCode: pc, userMessage: "That voice is no longer available. Pick another voice." };
  if (code === "text_too_long") return { retryable: false, code, providerCode: pc, userMessage: "That text is too long for this model." };
  if (code === "bad_prompt") return { retryable: false, code, providerCode: pc, userMessage: "This text was refused. Try different wording." };
  if (code === "unsupported_model" || code === "invalid_output_format") return { retryable: false, alert: true, code, providerCode: pc, userMessage: UNAVAILABLE };
  if (status === 404) return { retryable: false, code: "not_found", providerCode: pc, userMessage: "That voice or model was not found. Pick another." };
  if (status === 409) return { retryable: false, code: "conflict", providerCode: pc, userMessage: GENERIC };
  if (status === 422 || status === 400) return { retryable: false, code: code === `http_${status}` ? "invalid_request" : code, providerCode: pc, userMessage: "Those settings were not accepted. Try different settings." };
  return { retryable: false, code, providerCode: pc, userMessage: GENERIC };
}

export const NETWORK_ERROR: ProviderError = { retryable: true, code: "network", userMessage: GENERIC };
export const TIMEOUT_ERROR: ProviderError = { retryable: true, code: "timeout", userMessage: GENERIC };

const BUSY = "The voice service is busy. Please try again in a moment.";
const REFUSED = "This text was refused. Try different wording.";
const jsonOf = (body: string): Record<string, unknown> | null => { try { const j = JSON.parse(body); return j && typeof j === "object" ? (j as Record<string, unknown>) : null; } catch { return null; } };
const statusOnly = (status: number, code: string, pc: string | number): ProviderError | null => {
  if (status === 429) return { retryable: true, code: "rate_limited", providerCode: pc, userMessage: BUSY };
  if (status >= 500) return { retryable: true, code: "provider_unavailable", providerCode: pc, userMessage: GENERIC };
  if (status === 401 || status === 403) return { retryable: false, alert: true, code: "auth", providerCode: pc, userMessage: UNAVAILABLE };
  if (status === 402) return { retryable: false, alert: true, code: "insufficient_credits", providerCode: pc, userMessage: UNAVAILABLE };
  if (status === 404) return { retryable: false, code: "not_found", providerCode: pc, userMessage: "That voice or model was not found. Pick another." };
  if (status === 413) return { retryable: false, code: "too_large", providerCode: pc, userMessage: "That text is too long for this model." };
  if (status === 400 || status === 422) return { retryable: false, code: code || "invalid_request", providerCode: pc, userMessage: "Those settings were not accepted. Try different settings." };
  return null;
};

// Fish Audio: JSON {status, message, reason?}, but 413 and 5xx may have no body (docs/audio-providers/fish-audio.md section 1).
export function mapFishError(status: number, body: string): ProviderError {
  const j = jsonOf(body);
  const reason = typeof j?.reason === "string" ? j.reason : "";
  if (status === 503) return { retryable: true, code: "overloaded", providerCode: status, userMessage: BUSY };
  return statusOnly(status, reason, status) ?? { retryable: false, code: reason || `http_${status}`, providerCode: status, userMessage: GENERIC };
}

// MiniMax answers HTTP 200 even for failures: base_resp.status_code is the truth (docs/audio-providers/minimax.md section 1). 0 = success.
const MINIMAX_RETRY = new Set([1000, 1001, 1002, 1013, 1024, 1033, 1039, 2045]);
export function mapMiniMaxError(code: number, httpStatus = 200): ProviderError {
  if (httpStatus !== 200 && !code) return statusOnly(httpStatus, "", httpStatus) ?? { retryable: false, code: `http_${httpStatus}`, providerCode: httpStatus, userMessage: GENERIC };
  if (MINIMAX_RETRY.has(code)) return { retryable: true, code: code === 1002 || code === 2045 ? "rate_limited" : "provider_busy", providerCode: code, userMessage: code === 1002 || code === 2045 ? BUSY : GENERIC };
  if (code === 1004 || code === 2049) return { retryable: false, alert: true, code: "auth", providerCode: code, userMessage: UNAVAILABLE };
  if (code === 1008) return { retryable: false, alert: true, code: "insufficient_credits", providerCode: code, userMessage: UNAVAILABLE };
  if (code === 2038) return { retryable: false, alert: true, code: "no_permission", providerCode: code, userMessage: UNAVAILABLE };
  if (code === 2056) return { retryable: false, alert: true, code: "usage_limit", providerCode: code, userMessage: "The voice service has reached its usage limit for now. Please try again later." };
  if (code === 1026 || code === 1027) return { retryable: false, code: "content_refused", providerCode: code, userMessage: REFUSED };
  if (code === 1041) return { retryable: true, code: "connection_limit", providerCode: code, userMessage: BUSY };
  if (code === 1042) return { retryable: false, code: "invalid_characters", providerCode: code, userMessage: "This text has too many characters the model cannot read." };
  if (code === 2042 || code === 20132) return { retryable: false, code: "voice_unavailable", providerCode: code, userMessage: "That voice is no longer available. Pick another voice." };
  if (code === 2013) return { retryable: false, code: "invalid_request", providerCode: code, userMessage: "Those settings were not accepted. Try different settings." };
  return { retryable: false, code: `minimax_${code}`, providerCode: code, userMessage: GENERIC };
}

// Qwen (DashScope): {status_code, code, message}; 429 is the rate limit (docs/audio-providers/qwen3-tts.md section 3).
export function mapQwenError(status: number, body: string): ProviderError {
  const j = jsonOf(body);
  const code = typeof j?.code === "string" ? j.code : "";
  if (/DataInspection|data_inspection|sensitive/i.test(code)) return { retryable: false, code: "content_refused", providerCode: code, userMessage: REFUSED };
  if (/Throttling|RateQuota/i.test(code)) return { retryable: true, code: "rate_limited", providerCode: code, userMessage: BUSY };
  if (/InvalidApiKey|AccessDenied|Arrearage/i.test(code)) return { retryable: false, alert: true, code: "auth", providerCode: code, userMessage: UNAVAILABLE };
  return statusOnly(status, code, code || status) ?? { retryable: false, code: code || `http_${status}`, providerCode: code || status, userMessage: GENERIC };
}

// Seed Audio (BytePlus Seed Speech): HTTP 400/401/429/500, and a body `code` that can carry an error even with HTTP 200 (docs/audio-providers/seed-audio.md section 1).
export function mapSeedError(status: number, body: string): ProviderError {
  const j = jsonOf(body);
  const code = j?.code != null ? String(j.code) : "";
  if (code === "45000010") return { retryable: false, alert: true, code: "auth", providerCode: code, userMessage: UNAVAILABLE }; // Invalid X-Api-Key (an ARK key used by mistake)
  const httpLike = status === 200 && /^\d{3}$/.test(code) ? Number(code) : status;
  return statusOnly(httpLike, "", code || status) ?? { retryable: false, code: code ? `seed_${code}` : `http_${status}`, providerCode: code || status, userMessage: GENERIC };
}

// For a voice SAMPLE the generic "settings not accepted" is no help: say what a good sample is. Other errors (busy, owner alerts, refusals) keep their own message.
export const SAMPLE_HINT = "The sample was not accepted. Use a clean recording of one person speaking, 10 to 30 seconds, as MP3, WAV or M4A.";
export const forSample = (map: (status: number, body: string) => ProviderError) => (status: number, body: string): ProviderError => {
  const e = map(status, body);
  return !e.retryable && !e.alert && (e.code === "invalid_request" || /^http_4\d\d$/.test(e.code) || e.code === "not_found") ? { ...e, userMessage: SAMPLE_HINT } : e;
};

// Mirelo: the error envelope is {error: {code, message, param, retryable, request_id}} (docs/audio-providers/mirelo.md section 2.7). Branch on `code`, then on the HTTP status.
// 401 and 402 are for the owner (key, credits); an expired or missing job is a plain "try again".
export function mapMireloError(status: number, body: string): ProviderError {
  const j = jsonOf(body);
  const e = (j?.error && typeof j.error === "object" ? j.error : {}) as { code?: unknown; retryable?: unknown };
  const code = typeof e.code === "string" ? e.code : "";
  const pc = code || status;
  const BUSY_TRY = "The sound service is busy. Please try again in a moment.";
  if (code === "insufficient_credits" || code === "max_credits_exceeded" || status === 402) return { retryable: false, alert: true, code: "insufficient_credits", providerCode: pc, userMessage: "Sound generation is unavailable right now." };
  if (status === 401 || status === 403) return { retryable: false, alert: true, code: "auth", providerCode: pc, userMessage: "Sound generation is unavailable right now." };
  if (status === 429 || code === "asset_not_ready" || code === "sync_too_long") return { retryable: true, code: code === "asset_not_ready" ? "asset_not_ready" : "rate_limited", providerCode: pc, userMessage: BUSY_TRY };
  if (status >= 500) return { retryable: true, code: "provider_unavailable", providerCode: pc, userMessage: GENERIC_SOUND };
  if (code === "invalid_video") return { retryable: false, code, providerCode: pc, userMessage: "That video could not be read. Try another clip." };
  if (code === "capability_unsupported") return { retryable: false, code, providerCode: pc, userMessage: "That setting is not supported by this sound model. Try different settings." };
  if (code === "idempotency_conflict" || status === 409) return { retryable: false, code: "idempotency_conflict", providerCode: pc, userMessage: GENERIC_SOUND };
  if (code === "not_found" || status === 404) return { retryable: false, code: "not_found", providerCode: pc, userMessage: "That sound is no longer available. Please make it again." };
  if (code === "result_unreadable") return { retryable: true, code, providerCode: pc, userMessage: GENERIC_SOUND };
  if (code === "invalid_request" || status === 400 || status === 422) return { retryable: false, code: code || "invalid_request", providerCode: pc, userMessage: "Those settings were not accepted. Try different settings." };
  return { retryable: e.retryable === true, code: code || `http_${status}`, providerCode: pc, userMessage: GENERIC_SOUND };
}
const GENERIC_SOUND = "The sound could not be made right now. Please try again in a moment.";
