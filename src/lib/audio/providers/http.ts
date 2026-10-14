import { NETWORK_ERROR, TIMEOUT_ERROR } from "../errors";
import { ProviderFailure, type ProviderCtx, type ProviderError } from "../types";

// One plain fetch with a timeout, shared by the adapters. A non-OK answer is turned into a ProviderFailure by the adapter's own mapper; the raw body never leaves
// the server log (it can echo the person's text, so only the normalised code is logged).
export async function send(provider: string, ctx: ProviderCtx, url: string, init: RequestInit, map: (status: number, body: string) => ProviderError, timeoutMs = 120_000): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const onAbort = () => ctl.abort();
  ctx.signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    if (!res.ok) {
      const error = map(res.status, await res.text().catch(() => ""));
      console.warn(`${provider} error`, res.status, error.code);
      throw new ProviderFailure(error);
    }
    return res;
  } catch (err) {
    if (err instanceof ProviderFailure) throw err;
    if (err instanceof Error && err.name === "AbortError") throw new ProviderFailure(TIMEOUT_ERROR);
    throw new ProviderFailure(NETWORK_ERROR);
  } finally {
    clearTimeout(timer);
    ctx.signal?.removeEventListener("abort", onAbort);
  }
}

export const EMPTY_AUDIO: ProviderError = { retryable: true, code: "empty_audio", userMessage: "The voice could not be made right now. Please try again in a moment." };
export const NEEDS_VOICE: ProviderError = { retryable: false, code: "invalid_request", userMessage: "Pick a voice first." };

// Fetches audio the provider left at a short-lived address (Qwen, MiniMax url mode) so it can be stored at once.
export async function download(provider: string, ctx: ProviderCtx, url: string): Promise<Uint8Array> {
  // https only, or the provider's own base address (a local test server).
  let sameHost = false;
  try { sameHost = new URL(url).origin === new URL(ctx.baseUrl).origin; } catch { /* not an address */ }
  if (!/^https:\/\//i.test(url) && !sameHost) throw new ProviderFailure(EMPTY_AUDIO);
  const res = await send(provider, { ...ctx, apiKey: "" }, url, { method: "GET" }, (s) => ({ retryable: s >= 500 || s === 429, code: `download_${s}`, userMessage: EMPTY_AUDIO.userMessage }), 60_000);
  const b = new Uint8Array(await res.arrayBuffer());
  if (!b.length) throw new ProviderFailure(EMPTY_AUDIO);
  return b;
}
