"use client";

import GrowArea from "@/components/GrowArea";
import { attachKind } from "@/lib/attach-file";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUp, Camera, ScanFace, ChevronLeft, ChevronRight, Coins, ImageIcon, ChevronDown, Layers, Loader2, Eraser, Minus, Pencil, Plus, Shuffle, Sprout, Sun, Wand2, Workflow, X, ZoomIn } from "lucide-react";
import { createCanvasFromPrompt } from "@/lib/canvas-store";
import { imageCost, MAX_QTY, startImages, TIERS, tierResolution } from "@/lib/image-render";
import { MODEL_STORAGE_KEY, useModels } from "@/lib/use-models";
import { readCurrentProject } from "@/lib/projects";
import { PICK_LIMIT_BYTES, shrinkToFit } from "@/lib/shrink-image";
import { uploadPicture } from "@/lib/use-uploads";
import { useRenders } from "@/lib/use-renders";
import { fmtCredits, creditsText } from "@/lib/credit-units";
import { useCredits } from "@/lib/use-credits";
import RenderDetails from "../library/RenderDetails";
import ReferencePicker, { type RefPick } from "./ReferencePicker";
import PromptEdge, { type EdgeMessage } from "./PromptEdge";
import { cleanPicks, pickUrl, readDraft, writeDraft } from "@/lib/draft";
import ModelPicker, { AUTO } from "./ModelPicker";
import AgentIcon from "../AgentIcon";
import AgentMenu from "./AgentMenu";
import AgentWidget from "./AgentWidget";
import { useAgent } from "@/lib/use-agent";
import { useAgentHost } from "@/lib/agent-chat";
import "./create.css";
import { fallbackTo, thumbOf } from "@/lib/thumb-url";
import { CAMERA, RELIGHT, TOOL_LABEL, toolModel, toolPrompt, toolTier, type ToolId, type ToolOption } from "@/lib/picture-tools";
import SoulIdDialog from "./SoulIdDialog";

// Widest the preview gets for each shape: a compact thumbnail with 1/5 of the old area (old widths x 0.447).
const PREVIEW_WIDTH: Record<string, number> = { "1:1": 215, "4:5": 188, "9:16": 134, "16:9": 304 };
const previewWidth = (r: string) => PREVIEW_WIDTH[r] ?? 215;

export default function CreateStudio() {
  const router = useRouter();
  const urlPrompt = useSearchParams().get("prompt");
  const [prompt, setPrompt] = useState(urlPrompt ?? "");
  const [ratio, setRatio] = useState("1:1");
  const [qty, setQty] = useState(1);
  const [tier, setTier] = useState("1k");
  const models = useModels({ edit: true });
  const [refs, setRefs] = useState<RefPick[]>([]);
  // The box survives a refresh: text, shape, count, quality and the attached ingredients are kept as they change and put back on the next visit.
  const [draftReady, setDraftReady] = useState(false);
  useEffect(() => {
    const d = readDraft<{ prompt: string; ratio: string; qty: number; tier: string; refs: unknown }>("create");
    if (d) {
      if (!urlPrompt && typeof d.prompt === "string") setPrompt(d.prompt);
      if (typeof d.ratio === "string") setRatio(d.ratio);
      if (Number.isInteger(d.qty) && (d.qty as number) >= 1 && (d.qty as number) <= 4) setQty(d.qty as number);
      if (typeof d.tier === "string") setTier(d.tier);
      const picks = cleanPicks(d.refs, 10);
      if (picks.length) setRefs(picks.map((r) => ({ type: r.type, id: r.id, label: r.label, url: pickUrl(r) })));
    }
    setDraftReady(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (draftReady) writeDraft("create", { prompt, ratio, qty, tier, refs: refs.map(({ type, id, label }) => ({ type, id, label })) });
  }, [draftReady, prompt, ratio, qty, tier, refs]);
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
  const { credits: creditInfo } = useCredits();
  const model = modelId === AUTO ? autoModel : models?.find((m) => m.id === modelId) ?? null;
  const imgCost = imageCost(model ?? undefined, model?.resolutions.length ? tierResolution(model.resolutions, tier) : undefined, qty); // what Generate will cost, in ledger units

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
    if (model && ratio !== "auto" && !model.ratios.includes(ratio)) setRatio(model.ratios[0]);
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
  const [uploading, setUploading] = useState(0);
  async function uploadFromDevice(f: File | undefined) {
    if (!f) return;
    setError("");
    if (attachKind(f) !== "picture") { setError("Pictures are added here. Documents go into a chat (Atlas, Core, Prompts or Treatment)."); return; }
    if (f.size > PICK_LIMIT_BYTES) { setError("That picture is larger than 50 MB. Please use a smaller one."); return; }
    setUploading((n) => n + 1);
    try {
      const fitted = await shrinkToFit(f);
      if (!fitted) { setError("Could not make that picture small enough. Please try another."); return; }
      const r = await uploadPicture(fitted, "asset", f.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Picture", readCurrentProject()?.id ?? null);
      if (!r.ok) { setError(r.error); return; }
      const maxRefs = modelId === AUTO ? Math.max(...(models ?? []).filter((m) => !m.requiresReference).map((m) => m.maxReferences), 0) : (model?.maxReferences ?? 0);
      if (r.item && maxRefs > 0) { setNoRefs(false); setRefs((l) => (l.length < maxRefs ? [...l, { type: "upload", id: r.item!.id, url: r.item!.imageUrl, label: r.item!.name }] : l)); }
      else if (maxRefs === 0) setNoRefs(true);
    } finally { setUploading((n) => n - 1); }
  }

  function pickModel(id: string) {
    setModelId(id);
    setPickingModel(false);
    try { localStorage.setItem(MODEL_STORAGE_KEY, id); } catch {}
  }

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
      const { results, seed: firstSeed } = await startImages({ models: models ?? [], model, auto: modelId === AUTO, prompt: text, ratio, tier, qty: count, refs: refList, seedOn, seedNum, projectId: readCurrentProject()?.id, soulId: soulVersion ? soul?.id ?? null : null, soulStrength });
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
      // The picture shown in the preview is seen too, after the ingredients (the box takes four pictures at most).
      pictures: [
        ...refs.map((r, i) => ({ type: r.type, id: r.id, role: `ingredient ${i + 1}` })),
        ...(latestDone ? [{ type: "render" as const, id: latestDone.id, role: "shown in the preview" }] : []),
      ],
    }),
    setPrompt,
    generate: (o) => generate(o),
    // Atlas can choose the model, aspect ratio, count, quality and seed for the person (free; Generate stays their button).
    controls: {
      options: () => {
        const list = (models ?? []).map((m) => `${m.id} = ${m.label}${m.requiresReference ? " (needs a picture)" : ""}`).join("; ");
        return [
          `Models (id = name): auto = Auto (Eclipse picks); ${list}`,
          `Aspect ratios for the chosen model: ${(model?.ratios ?? [ratio]).join(", ")}${model ? ", auto" : ""}. Now: ${ratio}`,
          `Images per run: 1 to 4. Now: ${qty}`,
          `Quality: ${model?.resolutions.length ? TIERS.filter((t) => tierResolution(model.resolutions, t.id)).map((t) => t.id).join(", ") : "this model has one fixed quality"}. Now: ${tier}`,
          `Fixed seed: ${seedSupported ? "can be on or off" : "not available for this model"}. Now: ${seedOn ? "on" : "off"}`,
        ];
      },
      apply: (p) => {
        const set: string[] = [], refused: string[] = [];
        let m = model;
        if (p.model) {
          const want = p.model.trim().toLowerCase();
          if (want === "auto") { pickModel(AUTO); m = autoModel; set.push("Model Auto"); }
          else {
            const hit = models?.find((x) => x.id.toLowerCase() === want || x.label.toLowerCase() === want);
            if (hit) { pickModel(hit.id); m = hit; set.push(`Model ${hit.label}`); } else refused.push(`The model "${p.model}" isn't in the list.`);
          }
        }
        if (p.ratio) {
          const r = p.ratio.trim();
          if (r === "auto" || (m?.ratios ?? [r]).includes(r)) { setRatio(r); set.push(r === "auto" ? "Aspect ratio Auto" : `Aspect ratio ${r}`); } else refused.push(`${r} isn't an aspect ratio this model makes.`);
        }
        if (p.count != null) { const n = Math.min(4, Math.max(1, Math.round(p.count))); setQty(n); set.push(`${n} image${n > 1 ? "s" : ""}`); }
        if (p.quality) {
          const t = p.quality.trim().toLowerCase();
          if (TIERS.some((x) => x.id === t) && (!m?.resolutions.length || tierResolution(m.resolutions, t))) { setTier(t); set.push(`Quality ${t.toUpperCase()}`); } else refused.push(`${p.quality} quality isn't available for this model.`);
        }
        if (p.fixed_seed != null) {
          if (m?.seed?.supported) { flip("eclipse-fixed-seed", p.fixed_seed, setSeedOn); set.push(`Fixed seed ${p.fixed_seed ? "on" : "off"}`); } else refused.push("This model doesn't support a fixed seed.");
        }
        if (p.prompt) { setPrompt(p.prompt); set.push("Prompt"); }
        return { set, refused };
      },
    },
    // A frame Atlas captured from a video becomes an ingredient (Image Studio has no start frame).
    useFrame: (f) => {
      const max = modelId === AUTO ? Math.max(...(models ?? []).filter((m) => !m.requiresReference).map((m) => m.maxReferences), 0) : (model?.maxReferences ?? 0);
      if (max <= refs.length) return max === 0 ? "This model can't take pictures. Choose another model first." : "The box already holds as many pictures as this model takes.";
      setNoRefs(false);
      setRefs((l) => [...l, { type: "upload", id: f.id, url: `/api/uploads/${f.id}/file`, label: f.label }]);
      return "";
    },
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
  // Soul ID (Soul, Soul 2, Soul Cinema only): the chosen trained character and how closely to follow it, remembered per model version.
  const soulVersion = modelId === "soul" ? "v1" : modelId === "soul_v2" ? "v2" : modelId === "soul_cinema" ? "cinema" : null;
  const [soul, setSoul] = useState<{ id: string; name: string } | null>(null);
  const [soulStrength, setSoulStrength] = useState(1);
  const [soulOpen, setSoulOpen] = useState(false);
  useEffect(() => {
    if (!soulVersion) { setSoul(null); return; }
    try { const s = JSON.parse(localStorage.getItem(`eclipse-soul-id-${soulVersion}`) ?? "null"); setSoul(s && typeof s.id === "string" ? s : null); } catch { setSoul(null); }
  }, [soulVersion]);
  const pickSoul = (id: string | null, name?: string) => { const v = id ? { id, name: name ?? "Soul ID" } : null; setSoul(v); try { if (soulVersion) localStorage.setItem(`eclipse-soul-id-${soulVersion}`, JSON.stringify(v)); } catch {} };
  const [toolNote, setToolNote] = useState("");
  const [toolMenu, setToolMenu] = useState<"relight" | "camera" | null>(null);
  useEffect(() => { setToolNote(""); setToolMenu(null); }, [toolPic?.id]);
  // A picture tool makes a NEW image from this one (the original stays): the picture is the only ingredient, the instruction is fixed, the model is the best
  // picture-editing model this account has, and "auto" keeps the picture's aspect ratio.
  async function runTool(tool: ToolId, option?: ToolOption) {
    if (!toolPic || submitting) return;
    const m = toolModel(models ?? [], tool);
    if (!m) { setToolNote(`${TOOL_LABEL[tool]} needs a model that edits pictures, and none is connected yet.`); return; }
    setError(""); setToolNote(""); setSubmitting(true);
    try {
      const { results } = await startImages({ models: models ?? [], model: m, auto: false, prompt: toolPrompt(tool, option), ratio: "auto", tier: toolTier(m, tool), qty: 1, refs: [{ type: "render", id: toolPic.id }], seedOn: false, seedNum: null, projectId: readCurrentProject()?.id });
      const r = results[0];
      if (!r?.ok) throw new Error(r?.error ?? "Something went wrong. Please try again.");
      setToolMenu(null);
      if (r.id) setWatched(r.id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="cr-wrap">
      <header className="cr-intro">
        <h1 className="pg-title">Image Studio</h1>
        <p>Describe the shot you imagine.</p>
      </header>

      <section className="cr-preview" aria-label="Preview">
        {(() => {
          const shown = busy ? null : latestDone;
          const r = pending?.aspectRatio ?? shown?.aspectRatio ?? (ratio === "auto" ? "1:1" : ratio);
          return (
            <div className="cr-stage" style={{ aspectRatio: r.replace(":", " / "), maxWidth: previewWidth(r) }} aria-live="polite">
              {busy ? (
                <div className="cr-empty"><Loader2 size={30} className="cr-spin" /><p>Creating your image…</p></div>
              ) : shown?.imageUrl ? (
                <a href={`/api/generations/${shown.id}/file`} target="_blank" rel="noreferrer" title="Open full size">
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
                  <img src={thumbOf("render", r.id)} onError={fallbackTo(r.imageUrl)} alt={r.prompt} decoding="async" />
                </button>
              ))}
              <Link href="/gallery" className="cr-seeall" aria-label="See all in your Gallery" title="See all in your Gallery"><ArrowRight size={16} /></Link>
            </div>
          );
        })()}
      </section>

      <div className="cr-dock">
      <div className={`cr-tray ${toolPic ? "is-open" : ""}`} role="toolbar" aria-label="Tools for this picture" aria-hidden={!toolPic}>
        {toolMenu ? (
          <>
            <button type="button" tabIndex={toolPic ? 0 : -1} onClick={() => setToolMenu(null)} aria-label="Back to the tools"><X size={14} /> {TOOL_LABEL[toolMenu]}</button>
            {(toolMenu === "relight" ? RELIGHT : CAMERA).map((o) => (
              <button key={o.id} type="button" tabIndex={toolPic ? 0 : -1} disabled={submitting} onClick={() => void runTool(toolMenu, o)}>{o.label}</button>
            ))}
          </>
        ) : (
          <>
            <button type="button" tabIndex={toolPic ? 0 : -1} onClick={editPicture} title="Use this picture as an ingredient and describe the change"><Pencil size={14} /> Edit</button>
            <button type="button" tabIndex={toolPic ? 0 : -1} onClick={newVariations} disabled={submitting || !model} title="Make another image from the same prompt"><Shuffle size={14} /> Variations</button>
            <button type="button" tabIndex={toolPic ? 0 : -1} disabled={submitting} onClick={() => void runTool("upscale")} title="A sharper, higher-resolution copy of this picture"><ZoomIn size={14} /> Upscale</button>
            <button type="button" tabIndex={toolPic ? 0 : -1} disabled={submitting} onClick={() => void runTool("removebg")} title="The subject on a plain white background"><Eraser size={14} /> Remove background</button>
            <button type="button" tabIndex={toolPic ? 0 : -1} disabled={submitting} onClick={() => setToolMenu("relight")} title="Change the lighting"><Sun size={14} /> Relight</button>
            <button type="button" tabIndex={toolPic ? 0 : -1} disabled={submitting} onClick={() => setToolMenu("camera")} title="See the same moment from another angle"><Camera size={14} /> Change camera</button>
          </>
        )}
      </div>
      {toolNote && toolPic && <p className="cr-hint" role="status">{toolNote}</p>}
      <PromptEdge message={edge} />
      <form className="cr-box" onSubmit={(e) => { e.preventDefault(); submitBox(); }}>
        <label htmlFor="cr-prompt" className="sr-only">Describe the shot you imagine</label>
        <div className="cr-field">
          <button type="button" className="cr-plus" aria-label="Upload a picture from your device" title="Upload a picture from your device. By uploading you confirm you have the right to use it." onClick={() => fileInput.current?.click()}>{uploading > 0 ? <Loader2 size={16} className="cr-spin" /> : <Plus size={18} />}</button>
          <input ref={fileInput} type="file" multiple hidden onChange={(e) => { for (const f of Array.from(e.target.files ?? [])) void uploadFromDevice(f); e.target.value = ""; }} />
          <GrowArea
            id="cr-prompt"
            ref={box}
            rows={2}
            placeholder="Describe the shot you imagine…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onKeyDown}
          />
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
              <option value="auto">Auto</option>
              {(model?.ratios ?? [ratio]).filter((r) => r !== "auto").map((r) => <option key={r} value={r}>{r}</option>)}
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
          {soulVersion && (
            <button type="button" className={`cr-chip ${soul ? "is-on" : ""}`} aria-haspopup="dialog" title="A character trained from your own pictures" onClick={() => setSoulOpen(true)}>
              <ScanFace size={14} /> Soul ID{soul ? `: ${soul.name}` : ""}
            </button>
          )}
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
            {submitting ? <><Loader2 size={16} className="cr-spin" /> Generating</> : imgCost != null && modelId !== AUTO ? <>Generate {(creditInfo?.freeImages ?? 0) >= qty ? <span className="cr-cost" title="Free with your welcome offer">Free</span> : <span className="cr-cost" title={`${creditsText(imgCost)}${model && model.batch > 1 ? ` (up to ${model.batch} images for one price)` : ""}`}><Coins size={14} />{fmtCredits(imgCost)}</span>}</> : <>Generate <ArrowUp size={16} /></>}
          </button>
        </div>
      </form>
      </div>
      {picking && (model || modelId === AUTO) && <ReferencePicker max={modelId === AUTO ? Math.max(...(models ?? []).filter((m) => !m.requiresReference).map((m) => m.maxReferences), 0) : (model?.maxReferences ?? 0)} picked={refs} onChange={setRefs} onClose={() => setPicking(false)} />}
      {agentActive && agent && <AgentWidget name={agent} watch={pending || submitting ? ".cr-stage" : null} />}
      {agentAnchor && <AgentMenu anchor={agentAnchor} selected={agent} onPick={(n) => pickAgent(n)} onClose={() => setAgentAnchor(null)} />}
      {soulOpen && soulVersion && <SoulIdDialog version={soulVersion} selected={soul?.id ?? null} strength={soulStrength} onPick={pickSoul} onStrength={setSoulStrength} onClose={() => setSoulOpen(false)} />}
      {pickingModel && models && <ModelPicker models={models} value={modelId} onPick={pickModel} onClose={() => setPickingModel(false)} />}
    </div>
  );
}
