// Transcript helpers shared by the server (adapters) and the browser (copy and download). Pure: no server imports.
import type { Transcript, TranscriptSegment } from "./types";

export type TimedWord = { text: string; start: number; end: number; speaker?: string };

// Groups timed words into readable lines: a new line at the end of a sentence, when the speaker changes, after a pause of `gap` seconds, or at `maxWords` words.
export function segmentsFromWords(words: TimedWord[], opts: { gap?: number; maxWords?: number } = {}): TranscriptSegment[] {
  const gap = opts.gap ?? 1.0, maxWords = opts.maxWords ?? 14;
  const out: TranscriptSegment[] = [];
  let cur: TimedWord[] = [];
  const flush = () => {
    if (!cur.length) return;
    out.push({ text: cur.map((w) => w.text).join(" ").replace(/\s+([,.!?;:…])/g, "$1").trim(), start: cur[0].start, end: cur[cur.length - 1].end, speaker: cur[0].speaker });
    cur = [];
  };
  for (const w of words) {
    const last = cur[cur.length - 1];
    if (last && (w.speaker !== last.speaker || w.start - last.end > gap || cur.length >= maxWords)) flush();
    cur.push(w);
    if (/[.!?…。！？]["')\]”’]*$/.test(w.text)) flush();
  }
  flush();
  return out.filter((s) => s.text);
}

const pad = (n: number, w = 2) => String(Math.floor(n)).padStart(w, "0");
export const clockTime = (sec: number) => `${pad(sec / 60)}:${pad(sec % 60)}`;
function srtTime(sec: number) {
  const ms = Math.max(0, Math.round(sec * 1000));
  return `${pad(ms / 3_600_000)}:${pad((ms % 3_600_000) / 60_000)}:${pad((ms % 60_000) / 1000)},${pad(ms % 1000, 3)}`;
}

// A subtitle file (.srt) from the timed segments. Speakers are written before the line ("Speaker 1: ...").
export function toSrt(t: Pick<Transcript, "segments">): string {
  return t.segments.map((s, i) => `${i + 1}\n${srtTime(s.start)} --> ${srtTime(Math.max(s.end, s.start + 0.2))}\n${s.speaker ? `${s.speaker}: ` : ""}${s.text}\n`).join("\n");
}

// Plain text: with speakers, one line per turn; otherwise the text as the provider gave it.
export function toPlainText(t: Transcript): string {
  if (!t.segments.some((s) => s.speaker)) return t.text;
  const lines: string[] = [];
  let who: string | undefined, buf = "";
  for (const s of t.segments) {
    if (s.speaker !== who && buf) { lines.push(`${who ? `${who}: ` : ""}${buf.trim()}`); buf = ""; }
    who = s.speaker; buf += ` ${s.text}`;
  }
  if (buf.trim()) lines.push(`${who ? `${who}: ` : ""}${buf.trim()}`);
  return lines.join("\n\n");
}

// "speaker_0" or "0" or "A" become "Speaker 1" (people count from one).
export function speakerLabel(raw: unknown): string | undefined {
  if (raw == null || raw === "") return undefined;
  const s = String(raw);
  const n = /(\d+)\s*$/.exec(s)?.[1];
  return n != null ? `Speaker ${Number(n) + 1}` : `Speaker ${s.slice(0, 12)}`;
}
