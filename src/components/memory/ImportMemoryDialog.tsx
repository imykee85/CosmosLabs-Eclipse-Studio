"use client";

import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, X } from "lucide-react";
import BrandLogo from "@/components/connect/brands";
import { LogoMark } from "@/components/Logo";
import { MEMORY_TOPICS, TOPIC_LABEL, type MemoryTopic } from "@/lib/memory";

// Bring memory over from another assistant in three screens: pick the source, see what will be sent (the prompt typed into
// that assistant), then paste its answer back. "Start import" copies the prompt and opens the assistant in a new tab.
// Lines that start with a label (Projects:, Products:, Characters:, Style:, Tastes:) are filed under that topic by the
// server; the rest go under the topic chosen here. Brand marks belong to their owners and only name the source.
type Source = { id: string; brand: string; name: string; url?: string };
const SOURCES: Source[] = [
  { id: "claude", brand: "claude", name: "Claude", url: "https://claude.ai/new" },
  { id: "chatgpt", brand: "openai", name: "ChatGPT", url: "https://chatgpt.com/" },
  { id: "gemini", brand: "gemini", name: "Gemini", url: "https://gemini.google.com/app" },
  { id: "perplexity", brand: "perplexity", name: "Perplexity", url: "https://www.perplexity.ai/" },
  { id: "meta", brand: "meta", name: "Meta AI", url: "https://www.meta.ai/" },
  { id: "notes", brand: "notes", name: "Your own notes" },
];

const PROMPT = `List everything you remember about me from our conversations and your saved memory. Write one short fact per line as plain text, with no headings and no numbering. Start each line with one of these labels followed by a colon: Projects, Products, Characters, Style or Tastes. Include my projects, products, characters, visual style and taste, and anything I told you to always or never do. If you are not sure about something, leave it out.`;

// The prompt typed out inside a mock message box, so people see exactly what they are about to send.
function TypedPrompt({ name }: { name: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(PROMPT.length); return; }
    const t = setInterval(() => setN((v) => (v >= PROMPT.length ? v : v + 3)), 16);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="mm-imp-mock" aria-hidden="true">
      <span className="mm-imp-mock-title">{name}</span>
      <div className="mm-imp-mock-box"><p>{PROMPT.slice(0, n)}<i className="mm-imp-caret" /></p></div>
    </div>
  );
}

export default function ImportMemoryDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [source, setSource] = useState<Source | null>(null);
  const [stage, setStage] = useState<"intro" | "paste">("intro");
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

  async function start() {
    await copy();
    if (source?.url) window.open(source.url, "_blank", "noopener,noreferrer");
    setStage("paste");
  }

  function pick(s: Source) { setSource(s); setStage(s.id === "notes" ? "paste" : "intro"); setError(""); }
  function back() { if (source && stage === "paste" && source.id !== "notes") setStage("intro"); else { setSource(null); setError(""); } }

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
          {source ? <button type="button" className="mm-imp-round" aria-label="Back" onClick={back}><ChevronLeft size={18} /></button> : <h2>Import memory</h2>}
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
                  <button type="button" onClick={() => pick(s)}>
                    <BrandLogo brand={s.brand} size={38} /><span>{s.name}</span><ChevronRight size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : stage === "intro" ? (
          <>
            <TypedPrompt name={source.name} />
            <div className="mm-imp-link" aria-hidden="true">
              <BrandLogo brand={source.brand} size={46} />
              <span className="mm-imp-dashes" />
              <span className="mm-imp-eclipse"><LogoMark size={30} /></span>
            </div>
            <h3>Import your {source.name} memory</h3>
            <p className="mm-imp-sub">Send this prompt to {source.name}, then bring its answer back here.</p>
            <div className="mm-imp-go"><button type="button" className="cn-btn is-red" onClick={start}>Start import</button></div>
          </>
        ) : (
          <>
            <div className="mm-imp-who"><BrandLogo brand={source.brand} size={40} /><h3>{isNotes ? "Paste your notes" : `Paste ${source.name}'s answer`}</h3></div>
            {!isNotes && (
              <p className="mm-imp-note">The prompt is copied{source.url ? ` and ${source.name} is open in a new tab` : ""}. Paste it there, send it, then copy the whole answer and paste it below. <button type="button" className="mm-imp-again" onClick={copy}>{copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy the prompt again</>}</button></p>
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
