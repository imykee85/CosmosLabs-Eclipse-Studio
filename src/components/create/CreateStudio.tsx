"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { ArrowUp, ImageIcon, Layers, Loader2, Workflow } from "lucide-react";
import { seedFromPrompt } from "@/lib/canvas";
import { MODEL_STORAGE_KEY, rememberedModel, useModels } from "@/lib/use-models";
import { readCurrentProject } from "@/lib/projects";
import "./create.css";

// Widest the preview gets for each shape, so tall ones do not run off the screen.
const PREVIEW_WIDTH: Record<string, number> = { "1:1": 480, "4:5": 420, "9:16": 300, "16:9": 680 };
const previewWidth = (r: string) => PREVIEW_WIDTH[r] ?? 480;

type Result = { id: string; prompt: string; imageUrl: string; ratio: string };

export default function CreateStudio() {
  const router = useRouter();
  const [prompt, setPrompt] = useState(useSearchParams().get("prompt") ?? "");
  const [ratio, setRatio] = useState("1:1");
  const models = useModels();
  const [modelId, setModelId] = useState("");
  const model = models?.find((m) => m.id === modelId) ?? null;
  const [busy, setBusy] = useState<{ prompt: string; ratio: string } | null>(null);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (models?.length) setModelId(rememberedModel(models)?.id ?? "");
  }, [models]);

  // Keep the chosen shape one the chosen model supports.
  useEffect(() => {
    if (model && !model.ratios.includes(ratio)) setRatio(model.ratios[0]);
  }, [model, ratio]);

  function pickModel(id: string) {
    setModelId(id);
    try { localStorage.setItem(MODEL_STORAGE_KEY, id); } catch {}
  }

  // Grow the box with its content, up to a limit.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [prompt]);

  async function generate() {
    const text = prompt.trim();
    if (!text || busy || !model) return;
    setError("");
    setBusy({ prompt: text, ratio });
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, aspectRatio: ratio, model: model.id }),
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
        <p>Describe the shot you imagine. Your preview appears in the panel below.</p>
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
          <button type="button" className="cr-chip">
            <Layers size={14} /> Ingredients
          </button>
          <button type="button" className="cr-chip" title="Move this prompt to the Canvas"
            onClick={() => { if (prompt.trim()) seedFromPrompt(readCurrentProject()?.id ?? "default", { prompt: prompt.trim(), ratio }); router.push("/canvas"); }}>
            <Workflow size={14} /> Open in canvas
          </button>
          <label className="cr-chip cr-select" title={model?.blurb}>
            <span className="sr-only">Image model</span>
            <select value={modelId} onChange={(e) => pickModel(e.target.value)} aria-label="Image model">
              {(models ?? []).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
          <label className="cr-chip cr-select">
            <span className="sr-only">Aspect ratio</span>
            <select value={ratio} onChange={(e) => setRatio(e.target.value)} aria-label="Aspect ratio">
              {(model?.ratios ?? [ratio]).map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <button type="submit" className="cr-go" disabled={!prompt.trim() || !!busy || !model}>
            {busy ? <><Loader2 size={16} className="cr-spin" /> Generating</> : <>Generate <ArrowUp size={16} /></>}
          </button>
        </div>
      </form>
      <p className="cr-hint">Press Ctrl or Cmd + Enter to generate.</p>
      {error && <p className="cr-error" role="alert">{error}</p>}

      <section className="cr-preview" aria-label="Preview">
        <h2>Preview</h2>
        {(() => {
          const shown = busy ? null : results[0];
          const r = busy?.ratio ?? shown?.ratio ?? ratio;
          return (
            <div className="cr-stage" style={{ aspectRatio: r.replace(":", " / "), maxWidth: previewWidth(r) }} aria-live="polite">
              {busy ? (
                <div className="cr-empty"><Loader2 size={30} className="cr-spin" /><p>Creating your image…</p></div>
              ) : shown ? (
                <a href={shown.imageUrl} target="_blank" rel="noreferrer" title="Open full size">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={shown.imageUrl} alt={shown.prompt} />
                </a>
              ) : (
                <div className="cr-empty"><ImageIcon size={34} strokeWidth={1.4} /><p>Your preview appears here</p></div>
              )}
            </div>
          );
        })()}
        {!busy && results[0] && <p className="cr-caption">{results[0].prompt}</p>}
        {results.length > 1 && (
          <div className="cr-earlier" aria-label="Earlier renders">
            {results.slice(1).map((r) => (
              <a key={r.id} href={r.imageUrl} target="_blank" rel="noreferrer" title={r.prompt}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.imageUrl} alt={r.prompt} />
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
