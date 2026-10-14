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
