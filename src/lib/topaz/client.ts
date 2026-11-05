// Plain-fetch client for the Topaz API (server only; the key never reaches the browser). Branding: nothing in here is shown to people.
const BASE = () => (process.env.TOPAZ_BASE_URL || "https://api.topazlabs.com").replace(/\/+$/, "");
const UA = "Eclipse/1.0 (+https://eclipse.cosmoslabsai.com)"; // a custom User-Agent avoids the provider's Cloudflare 1010 block

export class TopazError extends Error {
  constructor(public status: number, public code: string, public body: string) { super(`Topaz ${status} ${code}`); }
  /** True when retrying later could work. */
  get retryable() { return this.status === 425 || this.status === 429 || this.status >= 500; }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function topaz(path: string, init: RequestInit & { raw?: boolean } = {}): Promise<Response> {
  const key = process.env.TOPAZ_API_KEY;
  if (!key) throw new TopazError(503, "NO_KEY", "");
  const url = /^https:\/\//.test(path) ? path : `${BASE()}${path}`;
  let last: TopazError | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { ...init, headers: { "X-API-Key": key, "User-Agent": UA, ...(init.headers as Record<string, string> | undefined) }, signal: init.signal ?? AbortSignal.timeout(60_000) });
    if (res.ok) return res;
    const text = await res.text().catch(() => "");
    let code = "";
    try { code = String((JSON.parse(text) as { code?: unknown }).code ?? ""); } catch { /* not JSON */ }
    last = new TopazError(res.status, code, text.slice(0, 400));
    if (!last.retryable || attempt === 2) break;
    const wait = Number(res.headers.get("retry-after")) || 2 ** attempt;
    await sleep(Math.min(wait, 8) * 1000 * (0.75 + Math.random() * 0.5));
  }
  throw last!;
}

export async function topazJson<T = Record<string, unknown>>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await topaz(path, init);
  return (await res.json().catch(() => ({}))) as T;
}

/** What a person is told for a failed call. Raw provider text goes to the logs only. */
export function topazMessage(err: unknown): string {
  if (err instanceof TopazError) {
    if (err.status === 402) return "Upscale is unavailable right now. Please try again later.";
    if (err.status === 429 || err.status === 425) return "Upscale is busy. Please try again in a minute.";
    if (err.status === 413 || err.status === 422 || err.status === 415) return "This file could not be upscaled.";
    if (err.status === 503) return "Upscale is not available yet.";
    if (err.status === 400) return "This file could not be upscaled.";
  }
  return "Upscale could not be started. Please try again.";
}
