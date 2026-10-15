import { ProviderFailure, type ProviderError } from "./types";

// Retries only transient provider failures (429, 5xx, network): exponential backoff with jitter, at most `tries` attempts. Never retries a refusal, bad settings or a billing error.
export async function withRetry<T>(fn: () => Promise<T>, opts: { tries?: number; baseMs?: number; sleep?: (ms: number) => Promise<void>; random?: () => number } = {}): Promise<T> {
  const tries = opts.tries ?? 3;
  const base = opts.baseMs ?? 1000;
  const sleep = opts.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const random = opts.random ?? Math.random;
  let last: ProviderError | null = null;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof ProviderFailure)) throw err;
      last = err.error;
      if (!err.error.retryable || attempt === tries - 1) throw err;
      await sleep(base * 2 ** attempt * (0.5 + random()));
    }
  }
  throw new ProviderFailure(last ?? { retryable: false, code: "unknown", userMessage: "The voice could not be made." });
}
