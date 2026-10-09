"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { ArrowUp, Check, ChevronLeft, ChevronRight, Coins, ImageIcon, ChevronDown, Layers, Loader2, Maximize2, Minimize2, Minus, Plus, Sprout, Wand2, Workflow, X } from "lucide-react";
import { seedFromPrompt } from "@/lib/canvas";
import { MODEL_STORAGE_KEY, useModels } from "@/lib/use-models";
import type { PublicModel } from "@/lib/models";
import { readCurrentProject } from "@/lib/projects";
import { useRenders } from "@/lib/use-renders";
import RenderDetails from "../library/RenderDetails";
import ReferencePicker, { type RefPick } from "./ReferencePicker";
import ModelPicker, { AUTO } from "./ModelPicker";
import AgentIcon from "../AgentIcon";
import AgentMenu from "./AgentMenu";
import { AGENTS, AGENT_KEY } from "../workspace/AgentPicker";
import "./create.css";

// Widest the preview gets for each shape: a compact thumbnail with 1/5 of the old area (old widths x 0.447).
const PREVIEW_WIDTH: Record<string, number> = { "1:1": 215, "4:5": 188, "9:16": 134, "16:9": 304 };
// Quality tiers on offer. A model takes the ones it can render: 1K and 2K and 4K by name, and Soul's 720p and 1080p
// stand in for 1K and 1.5K. Tiers a model cannot make are greyed out rather than guessed.
const TIERS = [{ id: "1k", label: "1K" }, { id: "1.5k", label: "1.5K" }, { id: "2k", label: "2K" }, { id: "4k", label: "4K" }];
const MAX_QTY = 4;
function tierResolution(resolutions: string[], tier: string): string | undefined {
  if (resolutions.includes(tier)) return tier;
  if (tier === "1k" && resolutions.includes("720p")) return "720p";
  if (tier === "1.5k" && resolutions.includes("1080p")) return "1080p";
  return undefined;
}
const previewWidth = (r: string) => PREVIEW_WIDTH[r] ?? 215;

export default function CreateStudio() {
  const router = useRouter();
  const [prompt, setPrompt] = useState(useSearchParams().get("prompt") ?? "");
  const [ratio, setRatio] = useState("1:1");
  const [qty, setQty] = useState(1);
  const [tier, setTier] = useState("1k");
  const models = useModels({ edit: true });
  const [refs, setRefs] = useState<RefPick[]>([]);
  const [modelId, setModelId] = useState("");
  const [pickingModel, setPickingModel] = useState(false);
  const [agentAnchor, setAgentAnchor] = useState<DOMRect | null>(null);
  // The agent helping with this work (None when no agent is chosen); the same choice the Agents page keeps.
  const [agent, setAgent] = useState<string | null>(null);
  useEffect(() => { try { const a = localStorage.getItem(AGENT_KEY); if (a && AGENTS.includes(a)) setAgent(a); } catch {} }, []);
  // Switches for the agent's help and a fixed seed. Both are remembered in this browser and nothing reads them yet.
  const [agentOn, setAgentOn] = useState(false);
  const [seedOn, setSeedOn] = useState(false);
  useEffect(() => { try { setAgentOn(localStorage.getItem("eclipse-agent-on") === "1"); setSeedOn(localStorage.getItem("eclipse-fixed-seed") === "1"); } catch {} }, []);
  function flip(key: string, on: boolean, set: (v: boolean) => void) { set(on); try { localStorage.setItem(key, on ? "1" : "0"); } catch {} }
  const agentChip = useRef<HTMLButtonElement>(null);
  function pickAgent(name: string | null) {
    setAgent(name);
    try { if (name) localStorage.setItem(AGENT_KEY, name); else localStorage.removeItem(AGENT_KEY); } catch {}
  }
  // Auto: Eclipse picks. The server never swaps models, so Auto resolves here to one real model: a verified one that can
  // take as many reference pictures as are chosen (never an edit-only model).
  const autoModel = (() => {
    const ok = (models ?? []).filter((m) => !m.requiresReference && m.maxReferences >= refs.length);
    return ok.find((m) => m.verified) ?? ok[0] ?? null;
  })();
  const model = modelId === AUTO ? autoModel : models?.find((m) => m.id === modelId) ?? null;
  const [picking, setPicking] = useState(false);
  const [noRefs, setNoRefs] = useState(false); // the chosen model takes no pictures: say so, with the models that do
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);

  // Renders live on the server, so they keep going if you leave this page, and are here when you come back.
  const [projectId, setProjectId] = useState<string | null | undefined>(undefined);
  useEffect(() => { setProjectId(readCurrentProject()?.id ?? null); }, []);
  const { renders, reload } = useRenders(projectId === undefined ? null : projectId, 12);
  const list = renders ?? [];
  const pending = list.find((g) => g.status === "pending") ?? null;
  // The big preview is for what you are making right now: it shows the render started on this visit and then clears
  // when you leave and come back. Earlier work stays in the row of small thumbnails (the five most recent).
  const [watched, setWatched] = useState<string | null>(null);
  useEffect(() => { if (pending) setWatched(pending.id); }, [pending]);
  const latestDone = list.find((g) => g.id === watched && g.status === "completed" && g.imageUrl) ?? null;
  const lastFailed = list[0]?.status === "failed" ? list[0] : null;

  useEffect(() => {
    if (!models?.length) return;
    let saved: string | null = null;
    try { saved = localStorage.getItem(MODEL_STORAGE_KEY); } catch {}
    setModelId(saved && models.some((m) => m.id === saved) ? saved : AUTO);
  }, [models]);

  // Keep the chosen shape one the chosen model supports.
  useEffect(() => {
    if (model && !model.ratios.includes(ratio)) setRatio(model.ratios[0]);
  }, [model, ratio]);
  // Keep the chosen quality to one the model can render; otherwise fall back to its first.
  useEffect(() => {
    if (!model || !model.resolutions.length || tierResolution(model.resolutions, tier)) return;
    const first = TIERS.find((t) => tierResolution(model.resolutions, t.id));
    if (first) setTier(first.id);
  }, [model, tier]);

  // A model takes only so many reference pictures; keep the choice within its limit.
  useEffect(() => { if (model && refs.length > model.maxReferences) setRefs((r) => r.slice(0, model.maxReferences)); }, [model, refs.length]);
  const needsRef = !!model?.requiresReference && refs.length === 0;
  useEffect(() => { setNoRefs(false); }, [modelId]);
  const refModels = (models ?? []).filter((m) => m.maxReferences > 0).map((m) => m.label);

  function pickModel(id: string) {
    setModelId(id);
    setPickingModel(false);
    try { localStorage.setItem(MODEL_STORAGE_KEY, id); } catch {}
  }

  // The prompt field shows two lines; once the text needs more, an expand button opens a full-screen editor.
  const [overflowing, setOverflowing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (el) setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [prompt, expanded]);
  // Keep the editor (and its Done button) above the on-screen keyboard.
  const [vvh, setVvh] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!expanded || !vv) return;
    const fit = () => setVvh(vv.height);
    fit();
    vv.addEventListener("resize", fit);
    return () => { vv.removeEventListener("resize", fit); setVvh(null); };
  }, [expanded]);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  async function generate() {
    const text = prompt.trim();
    if (!text || submitting || !model) return;
    setError("");
    setSubmitting(true);
    try {
      // On Auto each image gets its own pick: a model that fits the task (pictures, shape, quality), chosen at random from
      // the tested ones (or, when none fits, from the rest). A specific model is used as chosen.
      const pickFor = (): PublicModel => {
        if (modelId !== AUTO) return model;
        const fits = (models ?? []).filter((m) => !m.requiresReference && m.maxReferences >= refs.length && m.ratios.includes(ratio) && (!m.resolutions.length || !!tierResolution(m.resolutions, tier)));
        const tested = fits.filter((m) => m.verified);
        const pool = tested.length ? tested : fits;
        return pool[Math.floor(Math.random() * pool.length)] ?? model;
      };
      const refList = refs.map((r) => ({ type: r.type, id: r.id }));
      // Each image is its own render, started side by side.
      const results = await Promise.all(Array.from({ length: qty }, async () => {
        const m = pickFor();
        const body = JSON.stringify({ prompt: text, aspectRatio: ratio, model: m.id, resolution: m.resolutions.length ? tierResolution(m.resolutions, tier) : undefined, projectId: readCurrentProject()?.id, references: refList });
        const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, error: res.status === 503 ? "Generating is switched off in preview mode." : data.error ?? "Something went wrong. Please try again." };
      }));
      const failed = results.find((r) => !r.ok);
      if (failed && results.every((r) => !r.ok)) throw new Error(failed.error);
      if (failed) setError(`${results.filter((r) => !r.ok).length} of ${qty} images could not be started: ${failed.error}`);
      setPrompt("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
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
        <h1 className="pg-title">Image Studio</h1>
        <p>Describe the shot you imagine. Your preview appears in the panel above.</p>
      </header>

      <section className="cr-preview" aria-label="Preview">
        {(() => {
          const shown = pending ? null : latestDone;
          const r = pending?.aspectRatio ?? shown?.aspectRatio ?? ratio;
          return (
            <div className="cr-stage" style={{ aspectRatio: r.replace(":", " / "), maxWidth: previewWidth(r) }} aria-live="polite">
              {pending ? (
                <div className="cr-empty"><Loader2 size={30} className="cr-spin" /><p>Creating your image…</p></div>
              ) : shown?.imageUrl ? (
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
        {pending ? <p className="cr-caption">{pending.prompt}</p> : latestDone && (
          <div className="cr-details"><RenderDetails g={latestDone} onDeleted={reload} /></div>
        )}
        {(() => {
          const earlier = list.filter((g) => g.status === "completed" && g.imageUrl).slice(0, 5);
          return earlier.length > 0 && (
            <div className="cr-earlier" aria-label="Your five most recent renders">
              {earlier.map((r) => (
                <a key={r.id} href={r.imageUrl ?? undefined} target="_blank" rel="noreferrer" title={r.prompt}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.imageUrl ?? ""} alt={r.prompt} />
                </a>
              ))}
            </div>
          );
        })()}
      </section>

      <div className="cr-dock">
      <form className="cr-box" onSubmit={(e) => { e.preventDefault(); generate(); }}>
        <label htmlFor="cr-prompt" className="sr-only">Describe the shot you imagine</label>
        <div className="cr-field">
          <textarea
            id="cr-prompt"
            ref={box}
            rows={2}
            maxLength={Math.min(model?.maxPrompt ?? 2000, 5000)}
            placeholder="Describe the shot you imagine…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onKeyDown}
          />
          {(overflowing || prompt.includes("\n")) && (
            <button type="button" className="cr-expand" aria-label="Expand the prompt box" title="Expand" onClick={() => setExpanded(true)}><Maximize2 size={15} /></button>
          )}
        </div>
        {refs.length > 0 && (
          <div className="cr-refs" aria-label="Reference pictures">
            {refs.map((r, i) => (
              <span key={`${r.type}-${r.id}`} className="cr-ref" title={`Image ${i + 1}: ${r.label}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.url} alt={r.label} />
                <i className="cr-ref-n">{i + 1}</i>
                <button type="button" className="cr-ref-x" aria-label={`Remove ${r.label}`} onClick={() => setRefs((l) => l.filter((x) => !(x.type === r.type && x.id === r.id)))}><X size={12} /></button>
                {refs.length > 1 && (
                  <span className="cr-ref-move">
                    <button type="button" aria-label={`Move ${r.label} earlier`} disabled={i === 0} onClick={() => setRefs((l) => { const n = [...l]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })}><ChevronLeft size={12} /></button>
                    <button type="button" aria-label={`Move ${r.label} later`} disabled={i === refs.length - 1} onClick={() => setRefs((l) => { const n = [...l]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })}><ChevronRight size={12} /></button>
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
        <div className="cr-tools">
          <div className="cr-row cr-row-a">
          <label className="cr-chip cr-select">
            <span className="sr-only">Aspect ratio</span>
            <select value={ratio} onChange={(e) => setRatio(e.target.value)} aria-label="Aspect ratio">
              {(model?.ratios ?? [ratio]).map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <div className="cr-qty" role="group" aria-label="Number of images">
            <button type="button" aria-label="Fewer images" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus size={14} /></button>
            <span aria-live="polite">{qty}</span>
            <button type="button" aria-label="More images" disabled={qty >= MAX_QTY} onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}><Plus size={14} /></button>
          </div>
          <label className="cr-chip cr-select" title={model && !model.resolutions.length ? "This model has one fixed quality" : "Image quality"}>
            <span className="sr-only">Image quality</span>
            <select value={tier} onChange={(e) => setTier(e.target.value)} aria-label="Image quality" disabled={!model || !model.resolutions.length}>
              {TIERS.map((t) => <option key={t.id} value={t.id} disabled={!!model?.resolutions.length && !tierResolution(model.resolutions, t.id)}>{t.label}</option>)}
            </select>
          </label>
          <button type="button" className="cr-chip cr-modelbtn" aria-label="Image model" aria-haspopup="dialog" title={model?.blurb} onClick={() => setPickingModel(true)}>
            <span className="cr-mlabel">Model:</span>{modelId === AUTO && <Wand2 size={14} />}<span className="cr-mname">{modelId === AUTO ? "Auto" : model?.label ?? "Model"}</span><ChevronDown size={14} />
          </button>
          </div>
          <div className="cr-row cr-row-top">
          <button type="button" className="cr-chip" onClick={() => { if (modelId === AUTO || (model?.maxReferences ?? 0) > 0) { setNoRefs(false); setPicking(true); } else setNoRefs(true); }} title="Choose ingredients and pictures the model should work from">
            <Layers size={14} /> Ingredients{refs.length > 0 ? ` (${refs.length})` : ""}
          </button>
          <button type="button" className="cr-chip" aria-label="Open in canvas" title="Move this prompt to the Canvas"
            onClick={() => { if (prompt.trim()) seedFromPrompt(readCurrentProject()?.id ?? "default", { prompt: prompt.trim(), ratio }); router.push("/canvas"); }}>
            <Workflow size={14} /> Open in canvas
          </button>
            <div className="cr-grp">
            <button ref={agentChip} type="button" className="cr-chip" title="Choose your agent" aria-haspopup="menu" onClick={(e) => setAgentAnchor(e.currentTarget.getBoundingClientRect())}>
            <AgentIcon size={14} /> <span className="cr-mlabel">Agent:</span> <span className="cr-aname">{agent ?? "None"}</span>
          </button>
              <button type="button" role="switch" aria-checked={agentOn && !!agent} aria-label="Let the agent help with this prompt" title={agent ? "Agent help on or off" : "Choose an agent first"} className={`cr-switch ${agentOn && agent ? "is-on" : ""}`}
                onClick={() => { if (!agent) { if (agentChip.current) setAgentAnchor(agentChip.current.getBoundingClientRect()); return; } flip("eclipse-agent-on", !agentOn, setAgentOn); }}><i /></button>
            </div>
            <div className="cr-grp">
              <span className="cr-chip cr-seed"><Sprout size={14} /> Seed</span>
              <button type="button" role="switch" aria-checked={seedOn} aria-label="Fixed seed" title="Fixed seed" className={`cr-switch ${seedOn ? "is-on" : ""}`} onClick={() => flip("eclipse-fixed-seed", !seedOn, setSeedOn)}><i /></button>
            </div>
          </div>
          <button type="submit" className="cr-go" disabled={!prompt.trim() || submitting || !model || needsRef}>
            {submitting ? <><Loader2 size={16} className="cr-spin" /> Starting</> : model?.credits != null && modelId !== AUTO ? <>Generate <span className="cr-cost" title={`${model.credits * qty} credits`}><Coins size={14} />{model.credits * qty}</span></> : <>Generate <ArrowUp size={16} /></>}
          </button>
        </div>
      </form>
      {needsRef && <p className="cr-hint">{model?.label} edits a picture. Choose one with Ingredients first.</p>}
      {refs.length > 0 && <p className="cr-hint">The model reads your pictures in this order. Say what each one is for, for example &ldquo;use the person from image 1 and the jacket from image 2&rdquo;.</p>}
      {noRefs && <p className="cr-hint" role="status">{model?.label} does not use reference pictures. Choose a model that does{refModels.length ? `, such as ${refModels.slice(0, 3).join(", ")}` : ""}.</p>}
      {picking && (model || modelId === AUTO) && <ReferencePicker max={modelId === AUTO ? Math.max(...(models ?? []).filter((m) => !m.requiresReference).map((m) => m.maxReferences), 0) : (model?.maxReferences ?? 0)} picked={refs} onChange={setRefs} onClose={() => setPicking(false)} />}
      <p className="cr-hint cr-keys">Press Ctrl or Cmd + Enter to generate.</p>
      {pending && <p className="cr-hint">Your image keeps rendering if you leave this page. It will be in your Gallery when it is done.</p>}
      {(error || lastFailed) && <p className="cr-error" role="alert">{error || `Your last image could not be made: ${lastFailed?.error ?? "please try again."}`}</p>}
      </div>
      {agentAnchor && <AgentMenu anchor={agentAnchor} selected={agent} onPick={pickAgent} onClose={() => setAgentAnchor(null)} />}
      {pickingModel && models && <ModelPicker models={models} value={modelId} autoModel={autoModel} onPick={pickModel} onClose={() => setPickingModel(false)} />}
      {expanded && (
        <div className="cr-full" style={vvh ? { height: vvh, bottom: "auto" } : undefined} role="dialog" aria-label="Write your prompt">
          <button type="button" className="cr-full-x" aria-label="Back to the prompt box" title="Back" onClick={() => setExpanded(false)}><Minimize2 size={16} /></button>
          <textarea autoFocus aria-label="Prompt" value={prompt} maxLength={Math.min(model?.maxPrompt ?? 2000, 5000)} placeholder="Describe the shot you imagine…" onChange={(e) => setPrompt(e.target.value)} onFocus={(e) => e.currentTarget.setSelectionRange(prompt.length, prompt.length)} />
          <button type="button" className="cr-done" aria-label="Done" title="Done" onClick={() => setExpanded(false)}><Check size={20} /></button>
        </div>
      )}
    </div>
  );
}
