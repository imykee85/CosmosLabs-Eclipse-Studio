"use client";

import { useSearchParams } from "next/navigation";
import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { ArrowUp, Layers, Loader2 } from "lucide-react";
import "./create.css";

const RATIOS = ["1:1", "4:5", "9:16", "16:9"];

type Result = { id: string; prompt: string; imageUrl: string; ratio: string };

export default function CreateStudio() {
  const [prompt, setPrompt] = useState(useSearchParams().get("prompt") ?? "");
  const [ratio, setRatio] = useState("1:1");
  const [busy, setBusy] = useState<{ prompt: string; ratio: string } | null>(null);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const box = useRef<HTMLTextAreaElement>(null);

  // Grow the box with its content, up to a limit.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [prompt]);

  async function generate() {
    const text = prompt.trim();
    if (!text || busy) return;
    setError("");
    setBusy({ prompt: text, ratio });
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, aspectRatio: ratio }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(res.status === 503 ? "Generating is switched off in preview mode." : data.error ?? "Something went wrong. Please try again.");
      }
      setResults((r) => [{ id: data.id, prompt: text, imageUrl: data.imageUrl, ratio }, ...r]);
      setPrompt("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      generate();
    }
  }

  return (
    <div className="cr-wrap">
      <header className="cr-intro">
        <h1>Start creating</h1>
        <p>Describe the shot you imagine. Your render appears right below the box.</p>
      </header>

      <form className="cr-box" onSubmit={(e) => { e.preventDefault(); generate(); }}>
        <label htmlFor="cr-prompt" className="sr-only">Describe the shot you imagine</label>
        <textarea
          id="cr-prompt"
          ref={box}
          rows={2}
          maxLength={2000}
          placeholder="Describe the shot you imagine…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="cr-tools">
          <button type="button" className="cr-chip" disabled title="Coming soon">
            <Layers size={14} /> Ingredients <em>Soon</em>
          </button>
          <label className="cr-chip cr-select">
            <span className="sr-only">Aspect ratio</span>
            <select value={ratio} onChange={(e) => setRatio(e.target.value)} aria-label="Aspect ratio">
              {RATIOS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <button type="submit" className="cr-go" disabled={!prompt.trim() || !!busy}>
            {busy ? <><Loader2 size={16} className="cr-spin" /> Generating</> : <>Generate <ArrowUp size={16} /></>}
          </button>
        </div>
      </form>
      <p className="cr-hint">Press Ctrl or Cmd + Enter to generate.</p>
      {error && <p className="cr-error" role="alert">{error}</p>}

      {(busy || results.length > 0) && (
        <section className="cr-results" aria-live="polite" aria-label="Your renders">
          {busy && (
            <article className="cr-card">
              <div className="cr-img is-loading" style={{ aspectRatio: busy.ratio.replace(":", " / ") }}>
                <Loader2 size={26} className="cr-spin" />
              </div>
              <p>{busy.prompt}</p>
            </article>
          )}
          {results.map((r) => (
            <article key={r.id} className="cr-card">
              <a href={r.imageUrl} target="_blank" rel="noreferrer" className="cr-img" style={{ aspectRatio: r.ratio.replace(":", " / ") }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.imageUrl} alt={r.prompt} />
              </a>
              <p>{r.prompt}</p>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
