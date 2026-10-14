"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Copy, Download } from "lucide-react";
import { clockTime, toPlainText, toSrt } from "@/lib/audio/transcript";
import type { Transcript } from "@/lib/use-voice";

// A finished transcript: the text (a few lines, all of it on request), timed lines with speakers, Copy, and the text or subtitles (.srt) as a download.
function save(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function TranscriptView({ t, name }: { t: Transcript; name: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const base = name.replace(/\.[A-Za-z0-9]{1,5}$/, "").replace(/[^A-Za-z0-9._ -]+/g, "").trim().slice(0, 60) || "transcript";
  const plain = toPlainText(t);
  const timed = t.segments.length > 0;
  async function copy() {
    try { await navigator.clipboard.writeText(plain); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* the browser refused: the text can still be selected */ }
  }
  return (
    <div className="vc-tr">
      {open && timed
        ? <ol className="vc-tr-lines" aria-label="Transcript with times">
            {t.segments.map((s, i) => <li key={i}><time>{clockTime(s.start)}</time><span>{s.speaker && <b>{s.speaker}</b>}{s.text}</span></li>)}
          </ol>
        : <p className={`vc-tr-text ${open ? "is-open" : ""}`}>{plain}</p>}
      <div className="vc-tr-actions">
        <button type="button" className="vc-pill" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}{open ? "Show less" : timed ? "Show with times" : "Show all"}</button>
        <button type="button" className="vc-pill" onClick={() => void copy()}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button>
        <button type="button" className="vc-pill" onClick={() => save(`${base}.txt`, plain, "text/plain")}><Download size={14} />Text</button>
        {timed && <button type="button" className="vc-pill" onClick={() => save(`${base}.srt`, toSrt(t), "application/x-subrip")}><Download size={14} />Subtitles</button>}
      </div>
    </div>
  );
}
