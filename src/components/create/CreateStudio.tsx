"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUp, Camera, Check, ChevronLeft, ChevronRight, Coins, ImageIcon, ChevronDown, Layers, Loader2, Eraser, Maximize2, Minimize2, Minus, Pencil, Plus, Shuffle, Sprout, Sun, Wand2, Workflow, X, ZoomIn } from "lucide-react";
import { createCanvasFromPrompt } from "@/lib/canvas-store";
import { MAX_QTY, startImages, TIERS, tierResolution } from "@/lib/image-render";
import { MODEL_STORAGE_KEY, useModels } from "@/lib/use-models";
import { readCurrentProject } from "@/lib/projects";
import { PICK_LIMIT_BYTES, shrinkToFit } from "@/lib/shrink-image";
import { uploadPicture } from "@/lib/use-uploads";
import { useRenders } from "@/lib/use-renders";
import RenderDetails from "../library/RenderDetails";
import ReferencePicker, { type RefPick } from "./ReferencePicker";
import PromptEdge, { type EdgeMessage } from "./PromptEdge";
import ModelPicker, { AUTO } from "./ModelPicker";
import AgentIcon from "../AgentIcon";
import SoonTag from "../SoonTag";
import AgentMenu from "./AgentMenu";
import AgentWidget from "./AgentWidget";
import { useAgent } from "@/lib/use-agent";
import { useAgentHost } from "@/lib/agent-chat";
import "./create.css";

// Widest the preview gets for each shape: a compact thumbnail with 1/5 of the old area (old widths x 0.447).
const PREVIEW_WIDTH: Record<string, number> = { "1:1": 215, "4:5": 188, "9:16": 134, "16:9": 304 };
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
  // The agent helping with this work (None when no agent is chosen) and its switch: the same choice the Agents page keeps, shared with every screen that shows an agent.
  // While an agent is switched on, the floating agent's card is the chat; the prompt box stays a normal prompt box (the agent can fill it and start renders after approval).
  const { agent, on: agentOn, active: agentActive, setAgent: pickAgent, setOn: setAgentOn } = useAgent();
  const [seedOn, setSeedOn] = useState(false);
  useEffect(() => { try { setSeedOn(localStorage.getItem("eclipse-fixed-seed") === "1"); } catch {} }, []);
  function flip(key: string, on: boolean, set: (v: boolean) => void) { set(on); try { localStorage.setItem(key, on ? "1" : "0"); } catch {} }
  const agentChip = useRef<HTMLButtonElement>(null);
  // Auto: Eclipse picks. The server never swaps models, so Auto resolves here to one real model: a verified one that can
  // take as many reference pictures as are chosen (never an edit-only model).
  const autoModel = (() => {
    const ok = (models ?? []).filter((m) => m.autoPick && !m.requiresReference && m.maxReferences >= refs.length);
    return ok.find((m) => m.verified) ?? ok[0] ?? null;
  })();
  const model = modelId === AUTO ? autoModel : models?.find((m) => m.id === modelId) ?? null;

  // Fixed seed: the switch (remembered), the number (remembered) and what the chosen model allows. The server always sends a seed to a
  // model that has one (a random one when the switch is off) and never sends one to a model that does not.
  const [seedText, setSeedText] = useState("");
  const [seedNote, setSeedNote] = useState("");
  useEffect(() => { try { setSeedText(localStorage.getItem("eclipse-seed-value") ?? ""); } catch {} }, []);
  function putSeed(t: string) { setSeedText(t); try { if (t) localStorage.setItem("eclipse-seed-value", t); else localStorage.removeItem("eclipse-seed-value"); } catch {} }
  const seedSpec = model?.seed;
  const seedSupported = !!seedSpec?.supported;
  const seedLive = seedOn && seedSupported;
  const seedNum = /^\d+$/.test(seedText) ? Number(seedText) : null;
  const seedBad = seedLive && !!seedSpec && seedText !== "" && (seedNum == null || seedNum < seedSpec.min || seedNum > seedSpec.max);
  // A locked seed that does not fit the model you switch to is cleared, with a note.
  const lastSeedModel = useRef<string | null>(null);
  useEffect(() => {
    const id = model?.id ?? null;
    if (id === lastSeedModel.current) return;
    const first = lastSeedModel.current === null;
    lastSeedModel.current = id;
    if (first || !seedSpec?.supported || seedNum == null) return;
    if (seedNum < seedSpec.min || seedNum > seedSpec.max) { putSeed(""); setSeedNote("Seed reset: not valid for this model."); }
  }, [model, seedSpec, seedNum]);
  const randomizeSeed = () => { if (seedSpec) { putSeed(String(seedSpec.min + Math.floor(Math.random() * (seedSpec.max - seedSpec.min + 1)))); setSeedNote(""); } };
  const [picking, setPicking] = useState(false);
  const [noRefs, setNoRefs] = useState(false); // the chosen model takes no pictures: say so, with the models that do
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);

  // Renders live on the server, so they keep going if you leave this page, and are here when you come back.
  const [projectId, setProjectId] = useState<string | null | undefined>(undefined);
  useEffect(() => { setProjectId(readCurrentProject()?.id ?? null); }, []);
  const { renders, reload } = useRenders(projectId === undefined ? null : projectId, 12);
  const list = (renders ?? []).filter((g) => g.kind !== "video"); // Image Studio shows only images: videos live in Video Studio
  const pending = list.find((g) => g.status === "pending") ?? null;
  // The big preview is for what you are making right now: it shows the render started on this visit and then clears
  // when you leave and come back. Earlier work stays in the row of small thumbnails (the five most recent).
  const [watched, setWatched] = useState<string | null>(null);
  useEffect(() => { if (pending) setWatched(pending.id); }, [pending]);
  const latestDone = list.find((g) => g.id === watched && g.status === "completed" && g.imageUrl) ?? null;
  // GPT, Google and Seedream renders run inside the one request, so there is no pending row to see until they finish: the preview also shows "working" while the request is out.
  const busy = Boolean(pending) || submitting;
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

  function openIngredients() {
    if (modelId === AUTO || (model?.maxReferences ?? 0) > 0) { setNoRefs(false); setPicking(true); } else setNoRefs(true);
  }

  // The + in the prompt box: pick a picture from this device and attach it right away as an ingredient (it is saved to Assets).
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  async function uploadFromDevice(f: File | undefined) {
    if (!f) return;
    setError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) { setError("Only PNG, JPEG and WebP pictures can be uploaded."); return; }
    if (f.size > PICK_LIMIT_BYTES) { setError("That picture is larger than 25 MB. Please use a smaller one."); return; }
    setUploading(true);
    try {
      const fitted = await shrinkToFit(f);
      if (!fitted) { setError("Could not make that picture small enough. Please try another."); return; }
      const r = await uploadPicture(fitted, "asset", f.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Picture", readCurrentProject()?.id ?? null);
      if (!r.ok) { setError(r.error); return; }
      const maxRefs = modelId === AUTO ? Math.max(...(models ?? []).filter((m) => !m.requiresReference).map((m) => m.maxReferences), 0) : (model?.maxReferences ?? 0);
      if (r.item && maxRefs > refs.length) { setNoRefs(false); setRefs((l) => [...l, { type: "upload", id: r.item!.id, url: r.item!.imageUrl, label: r.item!.name }]); }
      else if (maxRefs === 0) setNoRefs(true);
    } finally { setUploading(false); }
  }

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

  // `over` is how the agent starts a render after the user approves it: its own prompt and count, never typed into the box.
  async function generate(over?: { prompt?: string; count?: number }): Promise<string> {
    const text = (over?.prompt ?? prompt).trim();
    const count = over?.count ?? qty;
    if (!text || submitting || !model) return !text ? "There is no prompt yet." : submitting ? "Another render is still starting." : "No model is ready yet.";
    if (needsRef) return `${model.label} needs an ingredient picture first.`;
    setError("");
    setSubmitting(true);
    try {
      const refList = refs.map((r) => ({ type: r.type, id: r.id }));
      const { results, seed: firstSeed } = await startImages({ models: models ?? [], model, auto: modelId === AUTO, prompt: text, ratio, tier, qty: count, refs: refList, seedOn, seedNum, projectId: readCurrentProject()?.id });
      if (firstSeed != null) putSeed(String(firstSeed));
      const note = results.find((r) => r.note)?.note;
      if (note) setSeedNote(note);
      const failed = results.find((r) => !r.ok);
      if (failed && results.every((r) => !r.ok)) throw new Error(failed.error);
      if (failed) setError(`${results.filter((r) => !r.ok).length} of ${count} images could not be started: ${failed.error}`);
      if (!over?.prompt) setPrompt("");
      const firstId = results.find((r) => r.ok && r.id)?.id;
      if (firstId) setWatched(firstId); // a render that finished inside the request never shows as pending, so point the preview at it now
      await reload();
      return "";
    } catch (e) {
      const why = e instanceof Error ? e.message : "Something went wrong. Please try again.";
      setError(why);
      return why;
    } finally {
      setSubmitting(false);
    }
  }

  // The one message shown on the top edge of the prompt box (errors first, then notices). It is also what the agent sees there.
  const edge: EdgeMessage =
    error || lastFailed ? { kind: "error", text: error || `Your last image could not be made: ${lastFailed?.error ?? "please try again."}` }
    : seedBad && seedSpec ? { kind: "error", text: `Use a whole number from ${seedSpec.min.toLocaleString("en-US")} to ${seedSpec.max.toLocaleString("en-US")} for this model.` }
    : needsRef ? { kind: "note", text: `${model?.label} edits a picture. Choose one with Ingredients first.` }
    : noRefs ? { kind: "note", text: `${model?.label} does not use reference pictures. Choose a model that does${refModels.length ? `, such as ${refModels.slice(0, 3).join(", ")}` : ""}.` }
    : seedNote ? { kind: "note", text: seedNote }
    : null;

  function submitBox() { void generate(); }
  useAgentHost({
    page: "studio",
    context: () => ({
      prompt, ratio, qty, model: modelId === AUTO ? "Auto" : model?.label, ingredients: refs.length,
      settings: [
        model?.resolutions.length ? `Quality: ${tier.toUpperCase()}` : "",
        seedSupported ? (seedOn ? `Fixed seed on${seedNum != null ? `: ${seedNum}` : ""}` : "Fixed seed off") : "Fixed seed: not available for this model",
        `Agent: ${agent ?? "none"}${agent ? (agentOn ? " (on)" : " (off)") : ""}`,
      ].filter(Boolean),
      message: edge?.text,
      pictures: refs.map((r, i) => ({ type: r.type, id: r.id, role: `ingredient ${i + 1}` })),
    }),
    setPrompt,
    generate: (o) => generate(o),
  });

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submitBox();
    }
  }

  // The tools for the picture in the preview. They sit tucked behind the prompt box and slide up when a picture is showing.
  const toolPic = busy ? null : latestDone;
  function editPicture() {
    if (!toolPic?.imageUrl) return;
    setRefs([{ type: "render", id: toolPic.id, url: toolPic.imageUrl, label: toolPic.prompt }]);
    if (modelId !== AUTO && (model?.maxReferences ?? 0) === 0) setNoRefs(true);
    box.current?.focus();
  }
  function newVariations() {
    if (toolPic) void generate({ prompt: toolPic.prompt });
  }
  const soon = (label: string) => setToolNote(`${label} is coming soon.`);
  const [toolNote, setToolNote] = useState("");
  useEffect(() => { setToolNote(""); }, [toolPic?.id]);

  return (
    <div className="cr-wrap">
      <header className="cr-intro">
        <h1 className="pg-title">Image Studio</h1>
        <p>Describe the shot you imagine.</p>
      </header>

      <section className="cr-preview" aria-label="Preview">
        {(() => {
          const shown = busy ? null : latestDone;
          const r = pending?.aspectRatio ?? shown?.aspectRatio ?? ratio;
          return (
            <div className="cr-stage" style={{ aspectRatio: r.replace(":", " / "), maxWidth: previewWidth(r) }} aria-live="polite">
              {busy ? (
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
        {busy ? <p className="cr-caption">{pending?.prompt ?? prompt}</p> : latestDone && (
          <div className="cr-details"><RenderDetails g={latestDone} onDeleted={reload} onStarted={reload} collapsible /></div>
        )}
        {(() => {
          const earlier = list.filter((g) => g.status === "completed" && g.imageUrl).slice(0, 5);
          return earlier.length > 0 && (
            <div className="cr-earlier" aria-label="Your five most recent renders">
              {earlier.map((r) => (
                <button key={r.id} type="button" className={r.id === latestDone?.id ? "is-on" : ""} aria-pressed={r.id === latestDone?.id} title={r.prompt} onClick={() => setWatched(r.id === latestDone?.id ? null : r.id)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.imageUrl ?? ""} alt={r.prompt} />
                </button>
              ))}
              <Link href="/gallery" className="cr-seeall" aria-label="See all in your Gallery" title="See all in your Gallery"><ArrowRight size={16} /></Link>
            </div>
          );
        })()}
      </section>

      <div className="cr-dock">
      <div className={`cr-tray ${toolPic ? "is-open" : ""}`} role="toolbar" aria-label="Tools for this picture" aria-hidden={!toolPic}>
        <button type="button" tabIndex={toolPic ? 0 : -1} onClick={editPicture} title="Use this picture as an ingredient and describe the change"><Pencil size={14} /> Edit</button>
        <button type="button" tabIndex={toolPic ? 0 : -1} onClick={newVariations} disabled={submitting || !model} title="Make another image from the same prompt"><Shuffle size={14} /> Variations</button>
        <button type="button" tabIndex={toolPic ? 0 : -1} onClick={() => soon("Upscale")}><ZoomIn size={14} /> Upscale <SoonTag /></button>
        <button type="button" tabIndex={toolPic ? 0 : -1} onClick={() => soon("Remove background")}><Eraser size={14} /> Remove background <SoonTag /></button>
        <button type="button" tabIndex={toolPic ? 0 : -1} onClick={() => soon("Relight")}><Sun size={14} /> Relight <SoonTag /></button>
        <button type="button" tabIndex={toolPic ? 0 : -1} onClick={() => soon("Change camera")}><Camera size={14} /> Change camera <SoonTag /></button>
      </div>
      {toolNote && toolPic && <p className="cr-hint" role="status">{toolNote}</p>}
      <PromptEdge message={edge} />
      <form className="cr-box" onSubmit={(e) => { e.preventDefault(); submitBox(); }}>
        <label htmlFor="cr-prompt" className="sr-only">Describe the shot you imagine</label>
        <div className="cr-field">
          <button type="button" className="cr-plus" aria-label="Upload a picture from your device" title="Upload a picture from your device. By uploading you confirm you have the right to use it." disabled={uploading} onClick={() => fileInput.current?.click()}>{uploading ? <Loader2 size={16} className="cr-spin" /> : <Plus size={18} />}</button>
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { void uploadFromDevice(e.target.files?.[0]); e.target.value = ""; }} />
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
          <button type="button" className="cr-chip" onClick={() => openIngredients()} title="Choose ingredients and pictures the model should work from">
            <Layers size={14} /> Ingredients{refs.length > 0 ? ` (${refs.length})` : ""}
          </button>
          <button type="button" className="cr-chip" aria-label="Open canvas" title="Move this prompt to a new canvas"
            onClick={async () => {
              // With a prompt typed, it becomes a new canvas (a text node feeding an image generator) and opens; otherwise the canvas library opens.
              const text = prompt.trim();
              if (!text) { router.push("/canvas"); return; }
              try { const made = await createCanvasFromPrompt(readCurrentProject()?.id ?? "default", { prompt: text, ratio }); router.push(made ? `/canvas?c=${made.id}` : "/canvas"); } catch { router.push("/canvas"); }
            }}>
            <Workflow size={14} /> Open canvas
          </button>
            <div className="cr-grp">
              <span className="cr-chip cr-seed"><Sprout size={14} /> Fixed seed</span>
              <button type="button" role="switch" aria-checked={seedLive} aria-label="Fixed seed" disabled={!seedSupported} title={seedSupported ? "Fixed seed: similar results with the same seed" : "This model doesn't support seeds"} className={`cr-switch ${seedLive ? "is-on" : ""}`} onClick={() => flip("eclipse-fixed-seed", !seedOn, setSeedOn)}><i /></button>
            </div>
            <div className="cr-grp">
            <button ref={agentChip} type="button" className="cr-chip" title="Choose your agent" aria-haspopup="menu" onClick={(e) => setAgentAnchor(e.currentTarget.getBoundingClientRect())}>
            <AgentIcon size={14} /> <span className="cr-aname">{agent ?? "Atlas"}</span>
          </button>
              <button type="button" role="switch" aria-checked={agentOn && !!agent} aria-label="Let the agent help with this prompt" title={agent ? "Agent help on or off" : "Choose an agent first"} className={`cr-switch ${agentOn && agent ? "is-on" : ""}`}
                onClick={() => { if (!agent) { if (agentChip.current) setAgentAnchor(agentChip.current.getBoundingClientRect()); return; } setAgentOn(!agentOn); }}><i /></button>
            </div>
          </div>
          {seedLive && seedSpec && (
            <div className="cr-seedrow">
              <label className="cr-seedfield">
                <span>Seed</span>
                <input inputMode="numeric" pattern="[0-9]*" aria-label="Seed number" value={seedText} placeholder={`${seedSpec.min.toLocaleString("en-US")} to ${seedSpec.max.toLocaleString("en-US")}`}
                  onChange={(e) => { putSeed(e.target.value.replace(/\D/g, "").slice(0, 10)); setSeedNote(""); }} />
              </label>
              <button type="button" className="cr-chip" onClick={randomizeSeed}><Shuffle size={14} /> Randomize</button>
            </div>
          )}
          <button type="submit" className="cr-go" disabled={!prompt.trim() || submitting || !model || needsRef || seedBad}>
            {submitting ? <><Loader2 size={16} className="cr-spin" /> Starting</> : model?.credits != null && modelId !== AUTO ? <>Generate <span className="cr-cost" title={`${model.credits * qty} credits`}><Coins size={14} />{model.credits * qty}</span></> : <>Generate <ArrowUp size={16} /></>}
          </button>
        </div>
      </form>
      </div>
      {picking && (model || modelId === AUTO) && <ReferencePicker max={modelId === AUTO ? Math.max(...(models ?? []).filter((m) => !m.requiresReference).map((m) => m.maxReferences), 0) : (model?.maxReferences ?? 0)} picked={refs} onChange={setRefs} onClose={() => setPicking(false)} />}
      {agentActive && agent && <AgentWidget name={agent} watch={pending || submitting ? ".cr-stage" : null} />}
      {agentAnchor && <AgentMenu anchor={agentAnchor} selected={agent} onPick={(n) => pickAgent(n)} onClose={() => setAgentAnchor(null)} />}
      {pickingModel && models && <ModelPicker models={models} value={modelId} onPick={pickModel} onClose={() => setPickingModel(false)} />}
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
