"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Box, Download, Loader2, Pencil, Plus, Shapes, Trash2, Wand2, X, Clapperboard, Check } from "lucide-react";
import SoonTag from "@/components/SoonTag";
import GrowArea from "@/components/GrowArea";
import ReferencePicker, { type RefPick } from "@/components/create/ReferencePicker";
import Viewer3D from "./Viewer3D";
import { delete3DModel, rename3DModel, start3DModel, use3D, type Item3D, type Model3DInfo } from "@/lib/use-design";
import { readCurrentProject, timeAgo } from "@/lib/projects";
import { putModel } from "@/lib/shot/world-store";
import "./design.css";

type Tab = "graphics" | "3d" | "motion";
type Mode = "image" | "multi" | "text";

// Graphic design starters: each opens Image Studio with a design-minded prompt the person finishes.
const PRESETS = [
  { name: "Logo", line: "A clean mark and wordmark", prompt: "A minimal modern logo for [brand], simple geometric mark with a clean wordmark, flat vector style, centred on a plain background" },
  { name: "Poster", line: "Bold, print-ready layout", prompt: "A bold event poster for [event], strong typographic hierarchy, striking central image, generous margins, print-ready design" },
  { name: "Social post", line: "Scroll-stopping square", prompt: "A scroll-stopping social media post for [topic], bold headline text, vibrant on-brand colours, clear focal point, 1:1" },
  { name: "Packaging", line: "Box, bottle or pouch", prompt: "Premium packaging design for [product], shown as a studio mockup on a soft neutral background, refined label typography" },
  { name: "Icon set", line: "A matching family of icons", prompt: "A set of 9 matching app icons for [theme], consistent line weight and rounded corners, flat colour, on a light grid" },
  { name: "Brand pattern", line: "A repeating surface", prompt: "A seamless repeating brand pattern inspired by [theme], two-colour palette, balanced density, tileable" },
  { name: "Book cover", line: "Title and artwork", prompt: "A striking book cover for a [genre] titled “[title]”, expressive artwork, elegant title typography, front cover only" },
  { name: "Mockup", line: "Show a design in real life", prompt: "A realistic mockup of [design] on [object], soft studio light, shallow depth of field, clean background" },
] as const;

const MODE_LABEL: Record<Mode, string> = { image: "One picture", multi: "Several views", text: "Describe it" };

export default function DesignStudio() {
  const [tab, setTab] = useState<Tab>("3d");
  return (
    <div className="ds">
      <header className="ds-head">
        <h1>Design Studio</h1>
        <p>Graphics, 3D models and motion, made in one place.</p>
      </header>
      <div className="ds-tabs" role="tablist" aria-label="Design tools">
        <button role="tab" aria-selected={tab === "graphics"} className={tab === "graphics" ? "is-on" : ""} onClick={() => setTab("graphics")}><Shapes size={16} />Graphics</button>
        <button role="tab" aria-selected={tab === "3d"} className={tab === "3d" ? "is-on" : ""} onClick={() => setTab("3d")}><Box size={16} />3D</button>
        <button role="tab" aria-selected={tab === "motion"} className={tab === "motion" ? "is-on" : ""} onClick={() => setTab("motion")}><Clapperboard size={16} />Motion <SoonTag /></button>
      </div>
      {tab === "graphics" && <Graphics />}
      {tab === "3d" && <ThreeD />}
      {tab === "motion" && <Motion />}
    </div>
  );
}

function Graphics() {
  return (
    <section aria-label="Graphic design">
      <p className="ds-lead">Pick a starting point. It opens Image Studio with a design prompt you finish.</p>
      <div className="ds-presets">
        {PRESETS.map((p) => (
          <Link key={p.name} href={`/create?prompt=${encodeURIComponent(p.prompt)}`} className="ds-preset">
            <b>{p.name}</b><span>{p.line}</span><ArrowUpRight size={16} />
          </Link>
        ))}
      </div>
    </section>
  );
}

function Motion() {
  return (
    <section aria-label="Motion graphics" className="ds-soon">
      <h2>Motion graphics <SoonTag /></h2>
      <p>Animated titles, explainers and launch films are on their way here. For ideas in the meantime, browse the motion gallery.</p>
      <Link href="/motion" className="ds-btn ds-btn-ghost">Open the motion gallery <ArrowUpRight size={16} /></Link>
    </section>
  );
}

function ThreeD() {
  const { items, models, reload } = use3D();
  const [mode, setMode] = useState<Mode>("image");
  const available = useMemo(() => models.filter((m) => m.modes.includes(mode)), [models, mode]);
  const [modelId, setModelId] = useState<string>("");
  const model: Model3DInfo | undefined = available.find((m) => m.id === modelId) ?? available[0];
  const [picked, setPicked] = useState<RefPick[]>([]);
  const [picker, setPicker] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [textured, setTextured] = useState(true);
  const [pbr, setPbr] = useState(false);
  const [poly, setPoly] = useState<number | null>(null);
  const [detailed, setDetailed] = useState(false);
  const [avoid, setAvoid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const needPics = mode !== "text";
  const maxPics = mode === "image" ? 1 : model?.maxImages ?? 4;
  const picsOk = !needPics || (picked.length >= (mode === "image" ? 1 : model?.minImages ?? 1) && picked.length <= maxPics);
  const canGo = !!model && !busy && picsOk && (mode !== "text" || prompt.trim().length >= 3);

  async function go() {
    if (!model || !canGo) return;
    setBusy(true); setError(null);
    const r = await start3DModel({
      model: model.id, mode, prompt: prompt.trim(),
      refs: needPics ? picked.slice(0, maxPics).map((p) => ({ type: p.type, id: p.id })) : [],
      options: { textured, pbr, polycount: poly, detailed, avoid: model.id === "tripo_3d" ? avoid : "" }, projectId: readCurrentProject()?.id ?? null,
    });
    setBusy(false);
    if (!r.ok) { if (r.code !== "UPGRADE" && r.code !== "SUBSCRIBE") setError(r.error); return; }
    await reload();
  }

  const shown = (items ?? []).find((i) => i.id === open) ?? (items ?? []).find((i) => i.status === "completed") ?? null;
  return (
    <section aria-label="3D generator" className="ds-3d">
      <div className="ds-panel">
        <div className="ds-seg" role="radiogroup" aria-label="How to start">
          {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? "is-on" : ""} onClick={() => { setMode(m); setPicked([]); setModelId(""); }}>{MODE_LABEL[m]}</button>
          ))}
        </div>
        {needPics ? (
          <div className="ds-pics">
            {picked.map((p, i) => (
              <div key={p.id} className="ds-pic">
                {/* eslint-disable-next-line @next/next/no-img-element -- plain img like the rest of the app */}
                <img src={p.url} alt={p.label || `Picture ${i + 1}`} />
                <button type="button" aria-label={`Remove picture ${i + 1}`} onClick={() => setPicked(picked.filter((x) => x.id !== p.id))}><X size={12} /></button>
              </div>
            ))}
            {picked.length < maxPics && <button type="button" className="ds-pic ds-pic-add" onClick={() => setPicker(true)} aria-label="Add a picture"><Plus size={20} /><span>{picked.length ? "Add view" : "Add picture"}</span></button>}
          </div>
        ) : (
          <GrowArea className="ds-text" rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="A weathered wooden fishing boat with a small cabin" aria-label="Describe the model" maxLength={600} />
        )}
        {mode === "text" && model?.id === "tripo_3d" && <GrowArea className="ds-text" rows={1} value={avoid} onChange={(e) => setAvoid(e.target.value)} placeholder="Leave out: blurry, flat, extra parts" aria-label="Things to leave out" maxLength={1024} />}
        {mode === "multi" && <p className="ds-hint">Same thing from different sides, in order: front, left, right, back.</p>}
        <label className="ds-field"><span>Model</span>
          <select value={model?.id ?? ""} onChange={(e) => setModelId(e.target.value)} aria-label="3D model">
            {available.map((m) => <option key={m.id} value={m.id}>{m.label}{m.credits ? ` · ${m.credits} credits` : ""}</option>)}
          </select>
        </label>
        {model && <p className="ds-hint">{model.blurb}</p>}
        <div className="ds-opts">
          <label><input type="checkbox" checked={textured} onChange={(e) => { setTextured(e.target.checked); if (!e.target.checked) setPbr(false); }} /> Colour and texture</label>
          <label className={textured ? "" : "is-off"}><input type="checkbox" checked={detailed} disabled={!textured} onChange={(e) => setDetailed(e.target.checked)} /> Extra detail (slower)</label>
          <label className={textured ? "" : "is-off"}><input type="checkbox" checked={pbr} disabled={!textured} onChange={(e) => setPbr(e.target.checked)} /> Realistic materials</label>
          {model && (
            <label className="ds-field ds-poly"><span>Detail</span>
              <input type="range" min={model.polyMin} max={model.polyMax} step={Math.max(1, Math.round((model.polyMax - model.polyMin) / 100))} value={poly ?? model.polyDefault} onChange={(e) => setPoly(Number(e.target.value))} aria-label="Detail (faces)" />
              <em>{(poly ?? model.polyDefault).toLocaleString()} faces</em>
            </label>
          )}
        </div>
        {error && <p className="ds-error" role="alert">{error}</p>}
        <button type="button" className="ds-btn ds-go" disabled={!canGo} onClick={go}>
          {busy ? <Loader2 size={18} className="ds-spin" /> : <Wand2 size={18} />}Make 3D model{model?.credits ? <span className="ds-price">{model.credits}</span> : null}
        </button>
      </div>

      <div className="ds-stage">
        {shown && shown.fileUrl ? (
          <>
            <Viewer3D url={shown.fileUrl} label={shown.name} />
            <ModelBar item={shown} onChanged={reload} />
          </>
        ) : (
          <div className="ds-empty"><Box size={34} /><b>Your model appears here</b><span>Add a picture or describe it, then press Make 3D model.</span></div>
        )}
        <div className="ds-list" aria-label="Your 3D models">
          {(items ?? []).map((i) => (
            <button key={i.id} type="button" className={`ds-chip ${shown?.id === i.id ? "is-on" : ""}`} onClick={() => setOpen(i.id)} disabled={i.status !== "completed"} aria-label={`${i.name}, ${i.status}`}>
              {i.status === "completed" ? <Box size={15} /> : i.status === "failed" ? <X size={15} /> : <Loader2 size={15} className="ds-spin" />}
              <span>{i.name}</span><em>{i.status === "completed" ? timeAgo(i.createdAt) : i.status === "failed" ? "failed" : "making…"}</em>
            </button>
          ))}
          {items && !items.length && <p className="ds-hint">Nothing yet.</p>}
        </div>
        {(items ?? []).filter((i) => i.status === "failed").slice(0, 1).map((i) => <p key={i.id} className="ds-error">{i.error}</p>)}
      </div>
      {picker && <ReferencePicker max={maxPics} picked={picked} onChange={setPicked} onClose={() => setPicker(false)} />}
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
