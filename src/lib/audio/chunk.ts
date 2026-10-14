// Splits a long text into pieces under a size limit, only at sentence ends where possible (docs/audio-providers/build-brief.md section 3).
// `unit` "byte" counts UTF-8 bytes (Fish bills and limits by bytes); "char" counts characters. Joined pieces always equal the input, minus the spaces at the cuts.
const size = (s: string, unit: "char" | "byte") => (unit === "byte" ? Buffer.byteLength(s, "utf8") : s.length);

// A sentence is text up to and including . ! ? … 。！？ (and closing quotes or brackets), followed by space, or a line break.
function sentences(text: string): string[] {
  const out: string[] = [];
  const re = /[^.!?…。！？\n]+(?:[.!?…。！？]+["')\]”’]*|\n+|$)\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) { if (m[0] === "") { re.lastIndex++; continue; } out.push(m[0]); }
  return out;
}

// A single sentence longer than the limit: cut at commas, then spaces, then (last resort) anywhere.
function splitLong(s: string, max: number, unit: "char" | "byte"): string[] {
  const out: string[] = [];
  let rest = s;
  while (size(rest, unit) > max) {
    let cut = -1;
    for (let i = rest.length; i > 0; i--) {
      if (size(rest.slice(0, i), unit) > max) continue;
      const ch = rest[i - 1];
      if (ch === "," || ch === ";" || ch === ":" || ch === "、" || ch === "，") { cut = i; break; }
      if (cut === -1 && /\s/.test(ch)) cut = i; // remember the last space, keep looking for a comma only within the first fit
      if (cut !== -1 && !/[,;:、，]/.test(ch) && i < rest.length - 200) break;
    }
    if (cut <= 0) { // no break point: hard cut at the largest fit (never splits a surrogate pair)
      cut = 0;
      for (let i = 1; i <= rest.length; i++) { if (size(rest.slice(0, i), unit) > max) break; cut = i; }
      if (cut > 0 && /[\uD800-\uDBFF]/.test(rest[cut - 1])) cut--;
      if (cut <= 0) cut = 1;
    }
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out.filter(Boolean);
}

export function splitForTts(text: string, max: number, unit: "char" | "byte" = "char"): string[] {
  const t = text.trim();
  if (!t) return [];
  if (size(t, unit) <= max) return [t];
  const chunks: string[] = [];
  let cur = "";
  const flush = () => { if (cur.trim()) chunks.push(cur.trim()); cur = ""; };
  for (const s of sentences(t)) {
    if (size(s, unit) > max) { flush(); chunks.push(...splitLong(s, max, unit)); continue; }
    if (cur && size(cur + s, unit) > max) flush();
    cur += s;
  }
  flush();
  return chunks;
}

// Joins constant-bitrate MP3 pieces (ElevenLabs mp3_44100_128). Byte joining may click at the seams: check by ear in the smoke test.
export function joinMp3(parts: Uint8Array[]): Uint8Array {
  if (parts.length === 1) return parts[0];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

// Length of a constant-bitrate MP3, from its size (128 kbps). Approximate: ID3 tags and the last frame are ignored.
export const mp3DurationMs = (bytes: number, kbps = 128) => Math.round((bytes * 8) / (kbps * 1000) * 1000);

// WAV (Qwen answers 16-bit PCM WAV): find the "fmt " and "data" chunks of a RIFF file.
type WavInfo = { fmt: Uint8Array; data: Uint8Array; byteRate: number };
export function readWav(b: Uint8Array): WavInfo | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const tag = (at: number) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);
  if (b.length < 12 || tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;
  let at = 12, fmt: Uint8Array | null = null, data: Uint8Array | null = null;
  while (at + 8 <= b.length) {
    const id = tag(at);
    let len = dv.getUint32(at + 4, true);
    if (id === "data" && (len === 0 || len === 0xffffffff || at + 8 + len > b.length)) len = b.length - at - 8; // streamed WAVs may leave the size unset
    if (id === "fmt ") fmt = b.subarray(at + 8, at + 8 + len);
    if (id === "data") { data = b.subarray(at + 8, at + 8 + len); break; }
    at += 8 + len + (len % 2);
  }
  if (!fmt || !data || fmt.length < 16) return null;
  const byteRate = new DataView(fmt.buffer, fmt.byteOffset, fmt.byteLength).getUint32(8, true);
  return { fmt, data, byteRate };
}

// Joins WAV pieces of the same format into one file (the first piece's format wins; pieces that are not WAV are refused).
export function joinWav(parts: Uint8Array[]): Uint8Array {
  if (parts.length === 1) return parts[0];
  const infos = parts.map(readWav);
  if (infos.some((i) => !i)) throw new Error("not a WAV piece");
  const first = infos[0]!;
  const dataLen = infos.reduce((n, i) => n + i!.data.length, 0);
  const out = new Uint8Array(12 + 8 + first.fmt.length + 8 + dataLen);
  const dv = new DataView(out.buffer);
  const put = (at: number, s: string) => { for (let i = 0; i < 4; i++) out[at + i] = s.charCodeAt(i); };
  put(0, "RIFF"); dv.setUint32(4, out.length - 8, true); put(8, "WAVE");
  put(12, "fmt "); dv.setUint32(16, first.fmt.length, true); out.set(first.fmt, 20);
  let at = 20 + first.fmt.length;
  put(at, "data"); dv.setUint32(at + 4, dataLen, true); at += 8;
  for (const i of infos) { out.set(i!.data, at); at += i!.data.length; }
  return out;
}

export const wavDurationMs = (b: Uint8Array) => { const i = readWav(b); return i && i.byteRate > 0 ? Math.round((i.data.length / i.byteRate) * 1000) : null; };
