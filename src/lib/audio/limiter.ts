// A per-provider limiter inside ONE server instance: a concurrency semaphore plus a requests-per-minute window (docs/audio-providers/build-brief.md section 3).
// Serverless instances do not share memory, so this smooths bursts from one instance; the provider's own 429 (retried with backoff, see retry.ts) is the real backstop.
export class Limiter {
  private running = 0;
  private waiters: Array<() => void> = [];
  private stamps: number[] = [];
  constructor(private maxConcurrent: number, private rpm: number, private now: () => number = Date.now, private sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))) {}

  async acquire(): Promise<() => void> {
    while (this.maxConcurrent > 0 && this.running >= this.maxConcurrent) await new Promise<void>((res) => this.waiters.push(res));
    this.running++;
    if (this.rpm > 0) {
      for (;;) {
        const t = this.now();
        this.stamps = this.stamps.filter((s) => t - s < 60_000);
        if (this.stamps.length < this.rpm) { this.stamps.push(t); break; }
        await this.sleep(Math.max(50, 60_000 - (t - this.stamps[0]) + 5));
      }
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.running--;
      this.waiters.shift()?.();
    };
  }
}

const limiters = new Map<string, Limiter>();
const num = (name: string, fallback: number) => (Number(process.env[name]) >= 0 && process.env[name] !== undefined && process.env[name] !== "" ? Math.floor(Number(process.env[name])) : fallback);

// AUDIO_<PROVIDER>_MAX_CONCURRENCY (default 2: the smallest ElevenLabs plan) and AUDIO_<PROVIDER>_RPM (default 0 = no per-minute window).
export function limiterFor(provider: string): Limiter {
  let l = limiters.get(provider);
  if (!l) {
    const key = provider.toUpperCase().replace(/[^A-Z0-9]/g, "_");
    l = new Limiter(num(`AUDIO_${key}_MAX_CONCURRENCY`, 2), num(`AUDIO_${key}_RPM`, 0));
    limiters.set(provider, l);
  }
  return l;
}
