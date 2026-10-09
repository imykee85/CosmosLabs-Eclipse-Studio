"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Check, ChevronLeft, ChevronRight, Copy, ExternalLink, X } from "lucide-react";
import BrandLogo from "@/components/connect/brands";
import { LogoMark } from "@/components/Logo";
import { MEMORY_TOPICS, TOPIC_LABEL, type MemoryTopic } from "@/lib/memory";

// Bring memory over from another assistant: pick the source, then one screen with a drawing of that assistant's message
// box, the prompt to copy (step 1) and a box to paste its answer (step 2). Lines that start with a label (Projects:,
// Products:, Characters:, Style:, Tastes:) are filed under that topic by the server; the rest go under the topic chosen
// here. Brand marks belong to their owners and only name the source.
type Source = { id: string; brand: string; name: string; url?: string; accent: string };
const SOURCES: Source[] = [
  { id: "claude", accent: "#d97757", brand: "claude", name: "Claude", url: "https://claude.ai/new" },
  { id: "chatgpt", accent: "#10a37f", brand: "openai", name: "ChatGPT", url: "https://chatgpt.com/" },
  { id: "gemini", accent: "#8e75b2", brand: "gemini", name: "Gemini", url: "https://gemini.google.com/app" },
  { id: "perplexity", accent: "#20b8cd", brand: "perplexity", name: "Perplexity", url: "https://www.perplexity.ai/" },
  { id: "meta", accent: "#0467df", brand: "meta", name: "Meta AI", url: "https://www.meta.ai/" },
  { id: "notes", accent: "#8a8a8e", brand: "notes", name: "Your own notes" },
];

const PROMPT = `List everything you remember about me from our conversations and your saved memory. Write one short fact per line as plain text, with no headings and no numbering. Start each line with one of these labels followed by a colon: Projects, Products, Characters, Style or Tastes. Include my projects, products, characters, visual style and taste, and anything I told you to always or never do. If you are not sure about something, leave it out.`;

// A simple drawing of the assistant's message box with the prompt being typed into it, tinted in the source's colour, so
// people see what they are about to send and where. Our own artwork; it only hints at each product's layout.
function TypedPrompt({ source }: { source: Source }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(PROMPT.length); return; }
    const t = setInterval(() => setN((v) => (v >= PROMPT.length ? v : v + 3)), 16);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="mm-imp-mock" aria-hidden="true" style={{ "--acc": source.accent } as React.CSSProperties}>
      <span className="mm-imp-mock-hi">What is on your mind?</span>
      <div className="mm-imp-composer">
        <p>{PROMPT.slice(0, n)}<i className="mm-imp-caret" /></p>
        <div className="mm-imp-composer-row"><span className="mm-imp-plus">+</span><span className="mm-imp-send"><ArrowUp size={13} /></span></div>
      </div>
    </div>
  );
}

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
          {source && <div className="mm-imp-crumbs"><span>Import memory</span><ChevronRight size={14} /><b>{source.name}</b></div>}
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
                  <button type="button" onClick={() => { setSource(s); setError(""); }}>
                    <BrandLogo brand={s.brand} size={38} /><span>{s.name}</span><ChevronRight size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            {!isNotes && <TypedPrompt source={source} />}
            <div className="mm-imp-link" aria-hidden="true">
              <BrandLogo brand={source.brand} size={46} />
              <span className="mm-imp-dashes" />
              <span className="mm-imp-eclipse"><LogoMark size={30} /></span>
            </div>
            <h3>{isNotes ? "Paste your notes" : `Import your ${source.name} memory`}</h3>
            <p className="mm-imp-sub">{isNotes ? "One fact per line. Start a line with Style:, Products: and so on to file it under that topic." : `Send the prompt below in ${source.name}, then paste its answer here.`}</p>

            {!isNotes && (
              <section className="mm-imp-step">
                <div className="mm-imp-step-head">
                  <span className="mm-imp-n">1</span><span>Copy and paste the prompt in {source.name}</span>
                  <button type="button" className="mm-imp-copy" onClick={copy}>{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}</button>
                </div>
                <div className="mm-imp-prompt"><p>{PROMPT}</p></div>
                {source.url && <a className="mm-imp-open" href={source.url} target="_blank" rel="noopener noreferrer" onClick={copy}>Open {source.name} <ExternalLink size={13} /></a>}
              </section>
            )}

            <section className="mm-imp-step">
              <div className="mm-imp-step-head"><span className="mm-imp-n">{isNotes ? "1" : "2"}</span><span>{isNotes ? "Your notes" : "Paste the answer here"}</span></div>
              <textarea className="mm-imp-area" rows={5} value={text} onChange={(e) => setText(e.target.value)} aria-label={isNotes ? "Your notes" : `${source.name}'s answer`} placeholder={"Style: Deep red and charcoal, high contrast\nProducts: Matte blue bottle with a silver cap\nTastes: Never show the product on a white background"} />
              <label className="mm-imp-fallback">Lines without a label go under
                <select value={topic} onChange={(e) => setTopic(e.target.value as MemoryTopic)}>{MEMORY_TOPICS.map((t) => <option key={t} value={t}>{TOPIC_LABEL[t]}</option>)}</select>
              </label>
            </section>
            {error && <p className="mm-imp-err" role="alert">{error}</p>}
            <div className="mm-imp-go"><button type="button" className="cn-btn is-red" disabled={!text.trim() || busy} onClick={run}>{busy ? "Importing…" : "Start import"}</button></div>
          </>
        )}
      </div>
    </div>
  );
}
