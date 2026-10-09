"use client";

import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, X } from "lucide-react";
import BrandLogo from "@/components/connect/brands";
import { MEMORY_TOPICS, TOPIC_LABEL, type MemoryTopic } from "@/lib/memory";

// Bring memory over from another assistant: pick where it comes from, copy a ready-made prompt into that assistant, paste its
// answer back here. Lines that start with a label (Projects:, Products:, Characters:, Style:, Tastes:) are filed under that
// topic by the server; the rest go under the topic chosen here. Brand marks belong to their owners and only name the source.
type Source = { id: string; brand: string; name: string; where: string };
const SOURCES: Source[] = [
  { id: "claude", brand: "claude", name: "Claude", where: "Open Claude and start a new chat." },
  { id: "chatgpt", brand: "openai", name: "ChatGPT", where: "Open ChatGPT and start a new chat." },
  { id: "gemini", brand: "gemini", name: "Gemini", where: "Open Gemini and start a new chat." },
  { id: "perplexity", brand: "perplexity", name: "Perplexity", where: "Open Perplexity and start a new thread." },
  { id: "meta", brand: "meta", name: "Meta AI", where: "Open Meta AI and start a new chat." },
  { id: "notes", brand: "notes", name: "Your own notes", where: "" },
];

const PROMPT = `List everything you remember about me from our conversations and your saved memory. Write one short fact per line as plain text, with no headings and no numbering. Start each line with one of these labels followed by a colon: Projects, Products, Characters, Style or Tastes. Include my projects, products, characters, visual style and taste, and anything I told you to always or never do. If you are not sure about something, leave it out.`;

export default function ImportMemoryDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [source, setSource] = useState<Source | null>(null);
  const [text, setText] = useState("");
  const [topic, setTopic] = useState<MemoryTopic>("tastes");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  async function copy() {
    try { await navigator.clipboard.writeText(PROMPT); } catch {
      const ta = document.createElement("textarea"); ta.value = PROMPT; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } finally { ta.remove(); }
    }
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  }

  async function run() {
    if (!text.trim() || busy) return;
    setBusy(true); setError("");
    const res = await fetch("/api/memory/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, text }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Could not import."); return; }
    onImported(); onClose();
  }

  const isNotes = source?.id === "notes";

  return (
    <div className="cn-modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="cn-modal mm-imp" role="dialog" aria-modal="true" aria-label="Import memory">
        <div className="mm-imp-head">
          {source ? <button type="button" className="mm-imp-round" aria-label="Back" onClick={() => { setSource(null); setError(""); }}><ChevronLeft size={18} /></button> : <h2>Import memory</h2>}
          <button type="button" className="mm-imp-round" aria-label="Close" onClick={onClose} disabled={busy}><X size={18} /></button>
        </div>

        {!source ? (
          <>
            <div className="mm-imp-hero">
              <span className="cn-stack" aria-hidden="true">{["claude", "openai", "gemini", "perplexity", "meta"].map((b) => <BrandLogo key={b} brand={b} size={42} />)}</span>
              <span className="mm-imp-time">About 3 min</span>
            </div>
            <h3>Bring your memory to Eclipse</h3>
            <p className="mm-imp-sub">Move what other assistants already know about you into your Eclipse memory.</p>
            <div className="mm-imp-label">Import from</div>
            <ul className="mm-imp-list">
              {SOURCES.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => setSource(s)}>
                    <BrandLogo brand={s.brand} size={38} /><span>{s.name}</span><ChevronRight size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <div className="mm-imp-who"><BrandLogo brand={source.brand} size={40} /><h3>{isNotes ? "Paste your notes" : `Import from ${source.name}`}</h3></div>
            {!isNotes && (
              <ol className="mm-imp-steps">
                <li>
                  <b>Copy this prompt.</b>
                  <div className="mm-imp-prompt"><p>{PROMPT}</p><button type="button" className="cn-btn" onClick={copy}>{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy prompt</>}</button></div>
                </li>
                <li><b>{source.where}</b> Paste the prompt and send it, then copy the whole answer.</li>
                <li><b>Paste the answer here.</b></li>
              </ol>
            )}
            <label className="cn-field">{isNotes ? "Your notes, one fact per line" : "Its answer"}
              <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Style: Deep red and charcoal, high contrast\nProducts: Matte blue bottle with a silver cap\nTastes: Never show the product on a white background"} />
            </label>
            <label className="cn-field">Lines without a label go under
              <select value={topic} onChange={(e) => setTopic(e.target.value as MemoryTopic)}>{MEMORY_TOPICS.map((t) => <option key={t} value={t}>{TOPIC_LABEL[t]}</option>)}</select>
            </label>
            {error && <p className="mm-imp-err" role="alert">{error}</p>}
            <div className="cn-actions"><button type="button" className="cn-btn is-red" disabled={!text.trim() || busy} onClick={run}>{busy ? "Importing…" : "Import"}</button></div>
          </>
        )}
      </div>
    </div>
  );
}
