// Small deterministic visuals for Voice Studio: a colour orb per voice and a waveform per take, both drawn from a hash so the same voice or take always looks the same.
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// A soft, lit sphere in neighbouring hues. Hues stay in Eclipse's warm range (crimson to amber, through magenta) so every voice sits on theme;
// the default ("eclipse") is the brand red.
export function orbStyle(seed: string): React.CSSProperties {
  const h = seed === "eclipse" ? 0 : hash(seed);
  const hue = seed === "eclipse" ? 356 : (325 + (h % 75)) % 360, spin = (h >> 9) % 360, shift = 14 + ((h >> 17) % 22);
  return {
    background: `radial-gradient(circle at 32% 28%, hsl(${hue} 95% 82% / .95), transparent 42%), conic-gradient(from ${spin}deg, hsl(${hue} 78% 52%), hsl(${(hue + shift) % 360} 80% 46%), hsl(${(hue + 360 - shift) % 360} 70% 34%), hsl(${hue} 78% 52%))`,
  };
}

// Bar heights (0.15 to 1) for a take's waveform: smooth, speech-like bumps.
export function bars(seed: string, n = 56): number[] {
  let x = hash(seed) || 1;
  const rnd = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 1000) / 1000; };
  const raw = Array.from({ length: n }, (_, i) => 0.35 + 0.65 * Math.abs(Math.sin(i * 0.42 + rnd() * 0.8)) * (0.55 + rnd() * 0.45));
  return raw.map((v, i) => Math.max(0.15, Math.min(1, (v + (raw[i - 1] ?? v) + (raw[i + 1] ?? v)) / 3)));
}

export const clock = (ms: number) => { const t = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
