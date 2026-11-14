"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import SoonTag from "@/components/SoonTag";
import { useSearchParams } from "next/navigation";
import AgentWidget from "@/components/create/AgentWidget";
import { useAgent } from "@/lib/use-agent";
import { useAgentHost } from "@/lib/agent-chat";
import "@/components/create/create.css";
import { ArrowRight, Box, Camera, ChevronDown, FolderOpen, Grid3x3, Info, Lightbulb, Palette, Search, Square, Download, Layers, Workflow, Loader2, Pencil, Plus, Trash2, X, Clapperboard, Check, Rotate3d } from "lucide-react";
import AtlasChip from "./AtlasChip";
import GrowArea from "@/components/GrowArea";
import { MODEL_ACCEPT, baseName, toGlb } from "@/lib/design/model-import";
import ReferencePicker, { type RefPick } from "@/components/create/ReferencePicker";
import Viewer3D, { FORMATS, type Bg, type ModelInfo, type ViewerApi } from "./Viewer3D";
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
  const [modelSheet, setModelSheet] = useState(false);
  const [local, setLocal] = useState<{ url: string; name: string } | null>(null);
  const glbInput = useRef<HTMLInputElement>(null);
  const viewer = useRef<ViewerApi | null>(null);
  const [wire, setWire] = useState(false), [grid, setGrid] = useState(true), [bg, setBg] = useState<Bg>("dark"), [bright, setBright] = useState(false);
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [toolMenu, setToolMenu] = useState<null | "info" | "formats">(null);
  const [toolNote, setToolNote] = useState("");
  const [lookAnchor, setLookAnchor] = useState<DOMRect | null>(null);
  const [viewAnchor, setViewAnchor] = useState<DOMRect | null>(null);
  // Which side of the object each picture shows. The models read the pictures in a fixed order, so choosing a side also puts the picture in that place.
  const [views, setViews] = useState<Record<string, string>>({});
  const VIEW_ORDER = model?.id === "hitem3d_2_0" ? ["Front", "Back", "Left", "Right"] : ["Front", "Left", "Right", "Back"];
  const setView = (id: string, v: string) => {
    const next: Record<string, string> = { ...views };
    for (const k of Object.keys(next)) if (next[k] === v) delete next[k];
    if (views[id] === v) delete next[id]; else next[id] = v;
    setViews(next);
    const rank = (x: RefPick) => { const i = VIEW_ORDER.indexOf(next[x.id] ?? ""); return i < 0 ? 9 : i; };
    setPicked([...picked].sort((a, b) => rank(a) - rank(b)));
  };
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
  async function toShotMap() {
    const src = local?.url ?? shown?.fileUrl; if (!src) return;
    try {
      const name = (local?.name ?? shown?.name ?? "Model").slice(0, 60);
      const key = await putModel(name, await (await fetch(src)).arrayBuffer());
      router.push(`/generate?shotmap=${encodeURIComponent(key)}&name=${encodeURIComponent(name)}`);
    } catch { setToolNote("Could not add it to ShotMap."); }
  }
  const trayOpen = !making && !!(local || (shown && shown.fileUrl));
  return (
    <section aria-label="3D generator" className={`cr-wrap ds-3d ${making ? "has-shot" : "is-idle"}`}>
      <section className="cr-preview" aria-label="Preview">
        <div className="cr-stage ds-stage3" aria-live="polite">
          {making ? (
            <div className="cr-empty"><Loader2 size={30} className="cr-spin" /><p>Making your model…</p></div>
          ) : local ? (
            <Viewer3D url={local.url} label={local.name} wire={wire} grid={grid} bg={bg} bright={bright} apiRef={viewer} onInfo={setInfo} />
          ) : shown && shown.fileUrl ? (
            <Viewer3D url={shown.fileUrl} label={shown.name} wire={wire} grid={grid} bg={bg} bright={bright} apiRef={viewer} onInfo={setInfo} />
          ) : (
            <div className="cr-empty"><Box size={34} strokeWidth={1.4} /><p>Your model appears here</p></div>
          )}
        </div>
        <input ref={glbInput} type="file" accept={MODEL_ACCEPT} hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void toGlb(f).then((buf) => setLocal((l) => { if (l) URL.revokeObjectURL(l.url); return { url: URL.createObjectURL(new Blob([buf], { type: "model/gltf-binary" })), name: baseName(f.name) }; })).catch((err) => setError(err instanceof Error ? err.message : "That file could not be read.")); }} />
        {local && !making ? (
          <div className="ds-bar"><b className="ds-name">{local.name} <em className="ds-localtag">on this device only</em></b><div className="ds-actions"><button type="button" className="ds-txt" onClick={() => { URL.revokeObjectURL(local.url); setLocal(null); }}>Close</button></div></div>
        ) : shown && shown.fileUrl && !making ? <ModelBar item={shown} onChanged={reload} /> : null}
        {(items ?? []).filter((i) => i.status === "failed").slice(0, 1).map((i) => <p key={i.id} className="ds-error">{i.error}</p>)}
        {(() => {
          const done = (items ?? []).filter((i) => i.status === "completed").slice(0, 5);
          return done.length > 0 && (
            <div className="cr-earlier" aria-label="Your five most recent 3D models">
              {done.map((i) => (
                <button key={i.id} type="button" className={`ds-hist ${shown?.id === i.id ? "is-on" : ""}`} aria-pressed={shown?.id === i.id} title={i.name} aria-label={i.name} onClick={() => setOpen(i.id)}><Box size={18} /></button>
              ))}
              <Link href="/library?kind=Design" className="cr-seeall" aria-label="See all in your Library" title="See all in your Library"><ArrowRight size={16} /></Link>
            </div>
          );
        })()}
      </section>

      {modelSheet && <ModelSheet3D models={available} value={model?.id ?? ""} onPick={(id) => { setModelId(id); setModelSheet(false); }} onClose={() => setModelSheet(false)} />}
      <div className="cr-dock">
        <div className={`cr-tray ${trayOpen ? "is-open" : ""}`} role="toolbar" aria-label="Tools for this model" aria-hidden={!trayOpen}>
          {toolMenu ? (
            <>
              <button type="button" tabIndex={trayOpen ? 0 : -1} onClick={() => setToolMenu(null)} aria-label="Back to the tools"><X size={14} /> {toolMenu === "info" ? "Info" : "Formats"}</button>
              {toolMenu === "info" && info && [`${info.faces.toLocaleString()} faces`, `${info.parts} ${info.parts === 1 ? "part" : "parts"}`, `${(info.w * 100).toFixed(0)} × ${(info.h * 100).toFixed(0)} × ${(info.d * 100).toFixed(0)}`].map((t) => <button key={t} type="button" tabIndex={-1} className="ds-tray-fact">{t}</button>)}
              {toolMenu === "formats" && FORMATS.map(([id, name, note]) => <button key={id} type="button" tabIndex={trayOpen ? 0 : -1} title={note} onClick={() => { void viewer.current?.download(id); setToolMenu(null); }}>{name}</button>)}
            </>
          ) : (
            <>
              <button type="button" tabIndex={trayOpen ? 0 : -1} className={wire ? "is-on" : ""} aria-pressed={wire} onClick={() => setWire(!wire)} title="Show only the edges the model is built from"><Square size={14} /> Wireframe</button>
              <button type="button" tabIndex={trayOpen ? 0 : -1} className={grid ? "is-on" : ""} aria-pressed={grid} onClick={() => setGrid(!grid)} title="Floor grid"><Grid3x3 size={14} /> Grid</button>
              <button type="button" tabIndex={trayOpen ? 0 : -1} onClick={() => setBg(bg === "dark" ? "light" : bg === "light" ? "studio" : "dark")} title="Change the background"><Palette size={14} /> Background</button>
              <button type="button" tabIndex={trayOpen ? 0 : -1} className={bright ? "is-on" : ""} aria-pressed={bright} onClick={() => setBright(!bright)} title="Brighter light"><Lightbulb size={14} /> Light</button>
              <button type="button" tabIndex={trayOpen ? 0 : -1} onClick={() => viewer.current?.still()} title="Save a picture of this angle"><Camera size={14} /> Picture</button>
              <button type="button" tabIndex={trayOpen ? 0 : -1} onClick={() => setToolMenu("info")} title="Size and detail"><Info size={14} /> Info</button>
              <button type="button" tabIndex={trayOpen ? 0 : -1} onClick={() => setToolMenu("formats")} title="Download in another format"><Download size={14} /> Formats</button>
              {["Retexture", "Remesh", "Animate", "Versions"].map((t) => <button key={t} type="button" tabIndex={trayOpen ? 0 : -1} onClick={() => setToolNote(`${t} is coming soon.`)}>{t} <SoonTag /></button>)}
            </>
          )}
        </div>
        {toolNote && trayOpen && <p className="cr-hint" role="status">{toolNote}</p>}
        {error && <p className="ds-error" role="alert">{error}</p>}
        <form className="cr-box" onSubmit={(e) => { e.preventDefault(); void go(); }}>
          {picked.length > 0 && (
            <div className="cr-refs">
              {picked.map((p, i) => (
                <div key={p.id} className="cr-ref">
                  {/* eslint-disable-next-line @next/next/no-img-element -- plain img like the rest of the app */}
                  <img src={p.url} alt={p.label || `Picture ${i + 1}`} />
                  <i className="cr-ref-n">{views[p.id] ?? i + 1}</i>
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
              <button type="button" className="cr-chip ds-iconchip" aria-label="Open your own 3D file" title="Open your own 3D file (.glb, .gltf, .obj, .stl, .fbx, .ply, .dae, .3mf), viewed on this device only" onClick={() => glbInput.current?.click()}><FolderOpen size={15} /></button>
              {picked.length > 1 && <button type="button" className={`cr-chip ds-iconchip ${Object.keys(views).length ? "is-on" : ""}`} aria-label="Label each picture's side" title="Say which side of the object each picture shows" aria-haspopup="menu" aria-expanded={!!viewAnchor} onClick={(e) => setViewAnchor(e.currentTarget.getBoundingClientRect())}><Rotate3d size={15} /></button>}
              <button type="button" className={`cr-chip ${rig && model?.rig ? "is-on" : ""}`} aria-pressed={!!(rig && model?.rig)} disabled={!model?.rig} title={model?.rig ? "Adds a skeleton so the model can be animated" : "Only Meshy 7 can rig a model. Choose it and add a picture."} onClick={() => setRig(!rig)}>Rig for animation</button>
              <button type="button" className={`cr-chip ${textured ? "is-on" : ""}`} aria-haspopup="menu" aria-expanded={!!lookAnchor} onClick={(e) => setLookAnchor(e.currentTarget.getBoundingClientRect())}>Colour and texture{detailed || pbr ? ` (${(detailed ? 1 : 0) + (pbr ? 1 : 0) + 1})` : ""}</button>
              <button type="button" className="cr-chip ds-modelsel" aria-haspopup="dialog" aria-expanded={modelSheet} aria-label="3D model" title={model?.blurb} onClick={() => setModelSheet(true)}>
                <span>{model?.label ?? "Model"}</span><ChevronDown size={14} aria-hidden="true" />
              </button>
            </div>
            <div className="cr-row">
              <button type="button" className={`cr-chip ds-detail ${poly !== null || detailOpen ? "is-on" : ""}`} aria-haspopup="dialog" aria-expanded={detailOpen} title="How many faces the model is built from" disabled={!model || model.polyMax <= 0} onClick={() => setDetailOpen(!detailOpen)}>Detail</button>
              <button type="button" className="cr-chip" disabled={!(local || (shown && shown.fileUrl))} title="Put this model into ShotMap as a scene object" onClick={() => void toShotMap()}>ShotMap</button>
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
      {viewAnchor && picked.length > 1 && (
        <>
          <div className="am-scrim" onMouseDown={() => setViewAnchor(null)} onTouchStart={() => setViewAnchor(null)} />
          <div className="am-menu ds-viewmenu" role="menu" aria-label="Picture sides" style={{ left: Math.max(8, Math.min(viewAnchor.left, window.innerWidth - 308)), width: Math.min(300, window.innerWidth - 16), bottom: window.innerHeight - viewAnchor.top + 8 }}>
            {picked.map((p, i) => (
              <div key={p.id} className="ds-viewrow">
                {/* eslint-disable-next-line @next/next/no-img-element -- plain img like the rest of the app */}
                <img src={p.url} alt={p.label || `Picture ${i + 1}`} />
                <div>{VIEW_ORDER.map((v) => <button key={v} type="button" className={`cr-chip ${views[p.id] === v ? "is-on" : ""}`} aria-pressed={views[p.id] === v} onClick={() => setView(p.id, v)}>{v}</button>)}</div>
              </div>
            ))}
          </div>
        </>
      )}
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
  return (
    <div className="ds-bar">
      {name === null ? <b className="ds-name">{item.name}</b> : (
        <input className="ds-rename" value={name} autoFocus aria-label="Model name" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setName(null); }} onBlur={async () => { const n = name.trim(); setName(null); if (n && n !== item.name) { await rename3DModel(item.id, n); await onChanged(); } }} />
      )}
      <div className="ds-actions">
        <button type="button" aria-label="Rename" onClick={() => setName(item.name)}><Pencil size={16} /></button>
        <a href={`${item.fileUrl}?download=1`} aria-label="Download .glb" download><Download size={16} /></a>
        <button type="button" aria-label={sure ? "Confirm delete" : "Delete"} className={sure ? "is-danger" : ""} onClick={async () => { if (!sure) { setSure(true); setTimeout(() => setSure(false), 3000); return; } await delete3DModel(item.id); await onChanged(); }}>{sure ? <Check size={16} /> : <Trash2 size={16} />}</button>
      </div>
      {note && <p className="ds-hint" role="status">{note}</p>}
    </div>
  );
}

// The model list as an in-app sheet (like Image Studio's model picker): models grouped by maker, searchable, with what each one does and its price.
function ModelSheet3D({ models, value, onPick, onClose }: { models: { id: string; label: string; maker: string; blurb: string; credits: number | null }[]; value: string; onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const list = models.filter((m) => !term || `${m.label} ${m.maker} ${m.blurb}`.toLowerCase().includes(term));
  const makers = Array.from(new Set(list.map((m) => m.maker)));
  return (
    <div className="mp-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mp-sheet" role="dialog" aria-label="3D model">
        <header className="mp-head"><h2>3D model</h2><button type="button" aria-label="Close" onClick={onClose}><X size={18} /></button></header>
        <label className="mp-search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search 3D models" /></label>
        <div className="mp-body">
          {makers.map((mk) => (
            <div key={mk}>
              <h3>{mk}</h3>
              {list.filter((m) => m.maker === mk).map((m) => (
                <button key={m.id} type="button" className={`mp-row ${value === m.id ? "is-on" : ""}`} onClick={() => onPick(m.id)}>
                  <span className="mp-name">{m.label}{m.blurb && <small>{m.blurb}</small>}</span>
                  {m.credits != null && <span className="mp-price">{m.credits}</span>}
                  {value === m.id && <Check size={16} />}
                </button>
              ))}
            </div>
          ))}
          {!list.length && <p className="mp-none">No model matches &ldquo;{q}&rdquo;.</p>}
        </div>
      </div>
    </div>
  );
}
