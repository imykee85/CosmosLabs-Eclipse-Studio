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
