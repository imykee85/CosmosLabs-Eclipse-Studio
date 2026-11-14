"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AgentWidget from "@/components/create/AgentWidget";
import { useAgent } from "@/lib/use-agent";
import { useAgentHost } from "@/lib/agent-chat";
import "@/components/create/create.css";
import { Box, Download, Layers, Workflow, Loader2, Pencil, Plus, Trash2, X, Clapperboard, Check } from "lucide-react";
import AtlasChip from "./AtlasChip";
import GrowArea from "@/components/GrowArea";
import ReferencePicker, { type RefPick } from "@/components/create/ReferencePicker";
import Viewer3D from "./Viewer3D";
import { delete3DModel, rename3DModel, start3DModel, use3D, type Item3D, type Model3DInfo } from "@/lib/use-design";
import { useRouter } from "next/navigation";
import { createCanvasFrom3D } from "@/lib/canvas-store";
import { readCurrentProject, timeAgo } from "@/lib/projects";
import { uploadPicture } from "@/lib/use-uploads";
import { putModel } from "@/lib/shot/world-store";
import MotionStudio from "./motion/MotionStudio";
import "./design.css";

type Tab = "3d" | "motion";
type Mode = "image" | "multi" | "text";

const MODE_LABEL: Record<Mode, string> = { image: "One picture", multi: "Several views", text: "Describe it" };

export default function DesignStudio() {
  const sp = useSearchParams();
  const [tab, setTab] = useState<Tab>(sp.get("tab") === "motion" ? "motion" : "3d");
  const agent = useAgent();
  return (
    <div className="ds">
      <header className="ds-head">
        <h1>Design Studio</h1>
        <p>3D models and motion graphics</p>
      </header>
      <div className="ds-toprow">
        <div className="ds-tabs" role="tablist" aria-label="Design tools">
          <button role="tab" aria-selected={tab === "3d"} className={tab === "3d" ? "is-on" : ""} onClick={() => setTab("3d")}><Box size={16} />3D</button>
          <button role="tab" aria-selected={tab === "motion"} className={tab === "motion" ? "is-on" : ""} onClick={() => setTab("motion")}><Clapperboard size={16} />Motion</button>
        </div>
      </div>
      {tab === "3d" && <ThreeD openId={sp.get("tab") === "3d" ? sp.get("open") : null} />}
      {tab === "motion" && <MotionStudio openId={sp.get("tab") === "motion" ? sp.get("open") : null} />}
      {agent.active && agent.agent && <AgentWidget name={agent.agent} watch={null} />}
    </div>
  );
}

function ThreeD({ openId = null }: { openId?: string | null }) {
  const router = useRouter();
  const { items, models, reload } = use3D();
  const [picked, setPicked] = useState<RefPick[]>([]);
  // The model list shows every model. Until one is chosen, the model follows what you add: nothing means words, one picture means one picture, more means several views.
  const want: Mode = (picked.length === 0 ? "text" : picked.length === 1 ? "image" : "multi");
  const available = models;
  const [modelId, setModelId] = useState<string>("");
  const model: Model3DInfo | undefined = models.find((m) => m.id === modelId) ?? models.find((m) => m.modes.includes(want)) ?? models[0];
  const mode: Mode = model?.modes.includes(want) ? want : (model?.modes[0] ?? want);
  const [picker, setPicker] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [textured, setTextured] = useState(true);
  const [pbr, setPbr] = useState(false);
  const [poly, setPoly] = useState<number | null>(null);
  const [detailed, setDetailed] = useState(false);
  const [avoid, setAvoid] = useState("");
  const [rig, setRig] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(openId);
  const [uploading, setUploading] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  // The model chip is as wide as the longest model name (measured in the chip's own font), plus room for the arrow.
  const [nameW, setNameW] = useState(0);
  useEffect(() => {
    const ctx = document.createElement("canvas").getContext("2d"); if (!ctx || !models.length) return;
    ctx.font = "500 14px Inter, system-ui, sans-serif";
    setNameW(Math.ceil(Math.max(...models.map((m) => ctx.measureText(m.label).width))));
  }, [models]);
  const [lookAnchor, setLookAnchor] = useState<DOMRect | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Atlas on the 3D tab: it sees the generator and can describe a model and start it (a description switches to "Describe it").
  useAgentHost({
    page: "design",
    context: () => ({ prompt, model: model?.label, settings: [`Tab: 3D models. Mode: ${MODE_LABEL[mode]}`, `Models for this mode: ${available.map((m) => m.label).join(", ")}`, `Colour and texture: ${textured ? "on" : "off"}, realistic materials: ${pbr ? "on" : "off"}, extra detail: ${detailed ? "on" : "off"}`], pictures: picked.map((p, i) => ({ type: p.type, id: p.id, role: mode === "multi" ? `view ${i + 1}` : "source picture" })) }),
    setPrompt: (t) => { setModelId(""); setPicked([]); setPrompt(t); },
    generate: async (o) => {
      const text = (o.prompt ?? prompt).trim();
      if (mode !== "text" && picked.length) { await go(); return ""; }
      const m = models.find((x) => x.modes.includes("text"));
      if (!m) return "No text-to-3D model is available.";
      if (text.length < 3) return "Describe the model first.";
      setPrompt(text);
      const r = await start3DModel({ model: m.id, mode: "text", prompt: text, refs: [], options: { textured, pbr, polycount: null, detailed, avoid: "", rig: false }, projectId: readCurrentProject()?.id ?? null });
      if (!r.ok) return r.code === "UPGRADE" || r.code === "SUBSCRIBE" ? "It needs a plan upgrade." : r.error;
      await reload(); return "";
    },
  });

  const needPics = mode !== "text";
  const maxPics = Math.max(1, Math.min(4, models.filter((m) => m.modes.includes("multi")).reduce((a, m) => Math.max(a, m.maxImages ?? 4), 4)));
  const picsOk = !needPics || (picked.length >= (mode === "image" ? 1 : model?.minImages ?? 1) && picked.length <= (model?.maxImages ?? maxPics));
  // Why Make is off when the chosen model does not fit what is in the box.
  const reason = !model ? "" : mode === "text" && picked.length > 0 ? `${model.label} works from words only. Remove the picture or choose another model.`
    : needPics && picked.length === 0 ? `${model.label} needs a picture. Add one with the + or Ingredients.`
    : needPics && picked.length > (model.maxImages ?? maxPics) ? `${model.label} takes at most ${model.maxImages} picture${model.maxImages === 1 ? "" : "s"}.`
    : needPics && picked.length < (mode === "image" ? 1 : model.minImages ?? 1) ? `${model.label} needs at least ${model.minImages} pictures.` : "";
  const canGo = !!model && !busy && !reason && (mode !== "text" || prompt.trim().length >= 3);

  async function fromDevice(f: File) {
    if (!f.type.startsWith("image/")) { setError("Add a picture here."); return; }
    setError(null); setUploading((n) => n + 1);
    try {
      const r = await uploadPicture(f, "asset", f.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Picture", readCurrentProject()?.id ?? null);
      if (!r.ok) { setError(r.error); return; }
      if (!r.item) return;
      const it = r.item;
      setPicked((l) => [...l, { type: "upload" as const, id: it.id, url: it.imageUrl, label: it.name }].slice(0, maxPics));
    } finally { setUploading((n) => n - 1); }
  }

  async function go() {
    if (!model || !canGo) return;
    setBusy(true); setError(null);
    const r = await start3DModel({
      model: model.id, mode, prompt: prompt.trim(),
      refs: needPics ? picked.slice(0, maxPics).map((p) => ({ type: p.type, id: p.id })) : [],
      options: { textured, pbr, polycount: poly, detailed, avoid: model.id === "tripo_3d" ? avoid : "", rig: model.rig && rig }, projectId: readCurrentProject()?.id ?? null,
    });
    setBusy(false);
    if (!r.ok) { if (r.code !== "UPGRADE" && r.code !== "SUBSCRIBE") setError(r.error); return; }
    await reload();
  }

  const shown = (items ?? []).find((i) => i.id === open) ?? (items ?? []).find((i) => i.status === "completed") ?? null;
  const making = (items ?? []).some((i) => i.status !== "completed" && i.status !== "failed");
  return (
    <section aria-label="3D generator" className={`cr-wrap ds-3d ${making ? "has-shot" : "is-idle"}`}>
      <section className="cr-preview" aria-label="Preview">
        <div className="cr-stage ds-stage3" aria-live="polite">
          {making ? (
            <div className="cr-empty"><Loader2 size={30} className="cr-spin" /><p>Making your model…</p></div>
          ) : shown && shown.fileUrl ? (
            <Viewer3D url={shown.fileUrl} label={shown.name} />
          ) : (
            <div className="cr-empty"><Box size={34} strokeWidth={1.4} /><p>Your model appears here</p></div>
          )}
        </div>
        {shown && shown.fileUrl && !making && <ModelBar item={shown} onChanged={reload} />}
        {(items ?? []).filter((i) => i.status === "failed").slice(0, 1).map((i) => <p key={i.id} className="ds-error">{i.error}</p>)}
        {(items ?? []).length > 0 && (
          <div className="ds-list" aria-label="Your 3D models">
            {(items ?? []).map((i) => (
              <button key={i.id} type="button" className={`ds-chip ${shown?.id === i.id ? "is-on" : ""}`} onClick={() => setOpen(i.id)} disabled={i.status !== "completed"} aria-label={`${i.name}, ${i.status}`}>
                {i.status === "completed" ? <Box size={15} /> : i.status === "failed" ? <X size={15} /> : <Loader2 size={15} className="ds-spin" />}
                <span>{i.name}</span><em>{i.status === "completed" ? timeAgo(i.createdAt) : i.status === "failed" ? "failed" : "making…"}</em>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="cr-dock">
        {error && <p className="ds-error" role="alert">{error}</p>}
        <form className="cr-box" onSubmit={(e) => { e.preventDefault(); void go(); }}>
          {picked.length > 0 && (
            <div className="cr-refs">
              {picked.map((p, i) => (
                <div key={p.id} className="cr-ref">
                  {/* eslint-disable-next-line @next/next/no-img-element -- plain img like the rest of the app */}
                  <img src={p.url} alt={p.label || `Picture ${i + 1}`} />
                  <i className="cr-ref-n">{i + 1}</i>
                  <button type="button" className="cr-ref-x" aria-label={`Remove picture ${i + 1}`} onClick={() => setPicked(picked.filter((x) => x.id !== p.id))}><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="cr-field">
            <button type="button" className="cr-plus" aria-label="Upload a picture from your device" title="Upload a picture from your device. By uploading you confirm you have the right to use it." onClick={() => fileInput.current?.click()}>{uploading > 0 ? <Loader2 size={16} className="cr-spin" /> : <Plus size={18} />}</button>
            <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => { for (const f of Array.from(e.target.files ?? [])) void fromDevice(f); e.target.value = ""; }} />
            <GrowArea className="ds-text" rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={picked.length ? "Add a note (optional)…" : "Describe the model you imagine, or add a picture…"} aria-label="Describe the model" maxLength={600} />
          </div>
          {mode === "text" && model?.id === "tripo_3d" && <GrowArea className="ds-text" rows={1} value={avoid} onChange={(e) => setAvoid(e.target.value)} placeholder="Leave out: blurry, flat, extra parts" aria-label="Things to leave out" maxLength={1024} />}
                    <div className="cr-tools">
            {reason && <p className="ds-hint">{reason}</p>}
            <div className="cr-row cr-row-a">
              <button type="button" className={`cr-chip ${rig && model?.rig ? "is-on" : ""}`} aria-pressed={!!(rig && model?.rig)} disabled={!model?.rig} title={model?.rig ? "Adds a skeleton so the model can be animated" : "Only Meshy 7 can rig a model. Choose it and add a picture."} onClick={() => setRig(!rig)}>Rig for animation</button>
              <button type="button" className={`cr-chip ${textured ? "is-on" : ""}`} aria-haspopup="menu" aria-expanded={!!lookAnchor} onClick={(e) => setLookAnchor(e.currentTarget.getBoundingClientRect())}>Colour and texture{detailed || pbr ? ` (${(detailed ? 1 : 0) + (pbr ? 1 : 0) + 1})` : ""}</button>
              <label className="cr-chip cr-select ds-modelsel" title={model?.blurb} style={nameW ? { width: nameW + 58 } : undefined}>
                <span className="sr-only">3D model</span>
                <select value={model?.id ?? ""} onChange={(e) => setModelId(e.target.value)} aria-label="3D model">
                  {available.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </label>
            </div>
            <div className="cr-row">
              <button type="button" className={`cr-chip ds-detail ${poly !== null || detailOpen ? "is-on" : ""}`} aria-haspopup="dialog" aria-expanded={detailOpen} title="How many faces the model is built from" disabled={!model || model.polyMax <= 0} onClick={() => setDetailOpen(!detailOpen)}>Detail</button>
              <button type="button" className="cr-chip" title="Use pictures from your Ingredients, Assets or earlier images" onClick={() => setPicker(true)}><Layers size={14} /> Ingredients{picked.length ? ` (${picked.length})` : ""}</button>
              <button type="button" className="cr-chip" aria-label="Open canvas" title="Move this prompt to a new canvas" onClick={async () => {
                const text = prompt.trim();
                if (!text) { router.push("/canvas"); return; }
                try { const made = await createCanvasFrom3D(readCurrentProject()?.id ?? "default", { prompt: text }); router.push(made ? `/canvas?c=${made.id}` : "/canvas"); } catch { router.push("/canvas"); }
              }}><Workflow size={14} /> Open canvas</button>
              <AtlasChip />
            </div>
            {detailOpen && model && model.polyMax > 0 && (
              <div className="ds-pop" role="dialog" aria-label="Detail settings">
                <label className="ds-field ds-poly"><span>Detail</span>
                  <input type="range" min={model.polyMin} max={model.polyMax} step={Math.max(1, Math.round((model.polyMax - model.polyMin) / 100))} value={poly ?? model.polyDefault} onChange={(e) => setPoly(Number(e.target.value))} aria-label="Detail (faces)" />
                  <em>{(poly ?? model.polyDefault).toLocaleString()} faces</em>
                </label>
                <button type="button" className="ds-pop-reset" onClick={() => setPoly(null)}>Use the default</button>
              </div>
            )}
            <button type="submit" className="cr-go ds-go3" disabled={!canGo}>
              {busy && <Loader2 size={18} className="ds-spin" />}Make 3D model{model?.credits ? <span className="ds-price">{model.credits}</span> : null}
            </button>
          </div>
        </form>
      </div>
      {lookAnchor && (
        <>
          <div className="am-scrim" onMouseDown={() => setLookAnchor(null)} onTouchStart={() => setLookAnchor(null)} />
          <div className="am-menu ds-lookmenu" role="menu" aria-label="Colour and texture" style={{ left: Math.max(8, Math.min(lookAnchor.left, window.innerWidth - 308)), width: Math.min(300, window.innerWidth - 16), bottom: window.innerHeight - lookAnchor.top + 8 }}>
            {([
              { on: textured, title: "Colour and texture", text: "Paint the model with colours and surface detail. Off gives a plain grey shape.", toggle: () => { setTextured(!textured); if (textured) setPbr(false); }, off: false },
              { on: detailed && textured, title: "Extra detail", text: "A sharper result. Slower.", toggle: () => setDetailed(!detailed), off: !textured },
              { on: pbr && textured, title: "Realistic materials", text: "Metal, cloth and glass look real.", toggle: () => setPbr(!pbr), off: !textured },
            ]).map((o) => (
              <button key={o.title} type="button" role="menuitemcheckbox" aria-checked={o.on} disabled={o.off} className="am-item" onClick={o.toggle}>
                <span><b>{o.title}</b><small>{o.text}</small></span>
                {o.on && <Check size={15} className="am-check" />}
              </button>
            ))}
          </div>
        </>
      )}
      {picker && <ReferencePicker max={Math.min(maxPics, models.filter((m) => m.modes.includes("multi")).reduce((a, m) => Math.max(a, m.maxImages ?? 1), 1))} picked={picked} onChange={(l) => { setPicked(l); }} onClose={() => setPicker(false)} />}
    </section>
  );
}

function ModelBar({ item, onChanged }: { item: Item3D; onChanged: () => Promise<void> | void }) {
  const [name, setName] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sure, setSure] = useState(false);
  async function toShotMap() {
    try {
      const buf = await (await fetch(item.fileUrl!)).arrayBuffer();
      await putModel(item.name || "Model", buf);
      setNote("Added. In ShotMap open Add, then Objects, and pick it from your models.");
    } catch { setNote("Could not add it to ShotMap."); }
  }
  return (
    <div className="ds-bar">
      {name === null ? <b className="ds-name">{item.name}</b> : (
        <input className="ds-rename" value={name} autoFocus aria-label="Model name" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setName(null); }} onBlur={async () => { const n = name.trim(); setName(null); if (n && n !== item.name) { await rename3DModel(item.id, n); await onChanged(); } }} />
      )}
      <div className="ds-actions">
        <button type="button" aria-label="Rename" onClick={() => setName(item.name)}><Pencil size={16} /></button>
        <a href={`${item.fileUrl}?download=1`} aria-label="Download .glb" download><Download size={16} /></a>
        <button type="button" className="ds-txt" onClick={toShotMap}>Add to ShotMap</button>
        <button type="button" aria-label={sure ? "Confirm delete" : "Delete"} className={sure ? "is-danger" : ""} onClick={async () => { if (!sure) { setSure(true); setTimeout(() => setSure(false), 3000); return; } await delete3DModel(item.id); await onChanged(); }}>{sure ? <Check size={16} /> : <Trash2 size={16} />}</button>
      </div>
      {note && <p className="ds-hint" role="status">{note}</p>}
    </div>
  );
}
