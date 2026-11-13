"use client";
import { useMemo, useRef, useState } from "react";
import AgentWidget from "@/components/create/AgentWidget";
import { useAgent } from "@/lib/use-agent";
import { useAgentHost } from "@/lib/agent-chat";
import "@/components/create/create.css";
import { Box, Download, Layers, Settings, Loader2, Pencil, Plus, Trash2, X, Clapperboard, Check } from "lucide-react";
import AtlasChip from "./AtlasChip";
import GrowArea from "@/components/GrowArea";
import ReferencePicker, { type RefPick } from "@/components/create/ReferencePicker";
import Viewer3D from "./Viewer3D";
import { delete3DModel, rename3DModel, start3DModel, use3D, type Item3D, type Model3DInfo } from "@/lib/use-design";
import { readCurrentProject, timeAgo } from "@/lib/projects";
import { uploadPicture } from "@/lib/use-uploads";
import { putModel } from "@/lib/shot/world-store";
import MotionStudio from "./motion/MotionStudio";
import "./design.css";

type Tab = "3d" | "motion";
type Mode = "image" | "multi" | "text";

const MODE_LABEL: Record<Mode, string> = { image: "One picture", multi: "Several views", text: "Describe it" };

export default function DesignStudio() {
  const [tab, setTab] = useState<Tab>("3d");
  const agent = useAgent();
  return (
    <div className="ds">
      <header className="ds-head">
        <h1>Design Studio</h1>
        <p>3D models and motion graphics, made in one place.</p>
      </header>
      <div className="ds-toprow">
        <div className="ds-tabs" role="tablist" aria-label="Design tools">
          <button role="tab" aria-selected={tab === "3d"} className={tab === "3d" ? "is-on" : ""} onClick={() => setTab("3d")}><Box size={16} />3D</button>
          <button role="tab" aria-selected={tab === "motion"} className={tab === "motion" ? "is-on" : ""} onClick={() => setTab("motion")}><Clapperboard size={16} />Motion</button>
        </div>
      </div>
      {tab === "3d" && <ThreeD />}
      {tab === "motion" && <MotionStudio />}
      {agent.active && agent.agent && <AgentWidget name={agent.agent} watch={null} />}
    </div>
  );
}

function ThreeD() {
  const { items, models, reload } = use3D();
  const [picked, setPicked] = useState<RefPick[]>([]);
  // No mode picker: nothing added means words, one picture means one picture, more means several views.
  const mode: Mode = picked.length === 0 ? "text" : picked.length === 1 ? "image" : "multi";
  const available = useMemo(() => models.filter((m) => m.modes.includes(mode)), [models, mode]);
  const [modelId, setModelId] = useState<string>("");
  const model: Model3DInfo | undefined = available.find((m) => m.id === modelId) ?? available[0];
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
  const [open, setOpen] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
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
  const canGo = !!model && !busy && picsOk && (mode !== "text" || prompt.trim().length >= 3);

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
    <section aria-label="3D generator" className="cr-wrap ds-3d">
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
            <div className="cr-row cr-row-a">
              <button type="button" className="cr-chip" title="Use pictures from your Ingredients, Assets or earlier images" onClick={() => setPicker(true)}><Layers size={14} /> Ingredients{picked.length ? ` (${picked.length})` : ""}</button>
              <button type="button" className={`cr-chip ${textured ? "is-on" : ""}`} aria-pressed={textured} onClick={() => { setTextured(!textured); if (textured) setPbr(false); }}>Colour and texture</button>
              <label className="cr-chip cr-select" title={model?.blurb}>
                <span className="sr-only">3D model</span>
                <select value={model?.id ?? ""} onChange={(e) => setModelId(e.target.value)} aria-label="3D model">
                  {available.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </label>
            </div>
            <div className="cr-row">
              <button type="button" className={`cr-chip ${detailed ? "is-on" : ""}`} aria-pressed={detailed} title="Slower, sharper" disabled={!textured} onClick={() => setDetailed(!detailed)}>Extra detail</button>
              <button type="button" className={`cr-chip ${pbr ? "is-on" : ""}`} aria-pressed={pbr} disabled={!textured} onClick={() => setPbr(!pbr)}>Realistic materials</button>
              {model?.rig && <button type="button" className={`cr-chip ${rig ? "is-on" : ""}`} aria-pressed={rig} onClick={() => setRig(!rig)}>Rig for animation</button>}
              <AtlasChip />
              <div className="ds-gearwrap">
                <button type="button" className={`cr-chip ds-gear ${poly !== null ? "is-on" : ""}`} aria-label="Detail settings" aria-haspopup="dialog" aria-expanded={detailOpen} title="Detail settings" disabled={!model || model.polyMax <= 0} onClick={() => setDetailOpen(!detailOpen)}><Settings size={16} /></button>
                {detailOpen && model && model.polyMax > 0 && (
                  <div className="ds-pop" role="dialog" aria-label="Detail settings">
                    <label className="ds-field ds-poly"><span>Detail</span>
                      <input type="range" min={model.polyMin} max={model.polyMax} step={Math.max(1, Math.round((model.polyMax - model.polyMin) / 100))} value={poly ?? model.polyDefault} onChange={(e) => setPoly(Number(e.target.value))} aria-label="Detail (faces)" />
                      <em>{(poly ?? model.polyDefault).toLocaleString()} faces</em>
                    </label>
                    <button type="button" className="ds-pop-reset" onClick={() => setPoly(null)}>Use the default</button>
                  </div>
                )}
              </div>
            </div>
            <button type="submit" className="cr-go ds-go3" disabled={!canGo}>
              {busy && <Loader2 size={18} className="ds-spin" />}Make 3D model{model?.credits ? <span className="ds-price">{model.credits}</span> : null}
            </button>
          </div>
        </form>
      </div>
      {picker && <ReferencePicker max={Math.min(maxPics, models.filter((m) => m.modes.includes("multi")).reduce((a, m) => Math.max(a, m.maxImages ?? 1), 1))} picked={picked} onChange={setPicked} onClose={() => setPicker(false)} />}
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
