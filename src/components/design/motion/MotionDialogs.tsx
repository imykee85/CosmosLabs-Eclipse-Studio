"use client";
import { useRef, useState } from "react";
import { Check, FileText, Globe, Image as ImageIcon, Loader2, Plus, Trash2, X } from "lucide-react";
import ReferencePicker, { type RefPick } from "@/components/create/ReferencePicker";
import GrowArea from "@/components/GrowArea";
import { exportMotion, fileName, type MotionHost } from "@/lib/design/motion/client";
import { pixelSize, FONT_FAMILIES, type BrandKitItem, type MotionClip, type MotionVersionItem } from "@/lib/design/motion/spec";
import { uploadVideo } from "@/lib/use-uploads";
import { readCurrentProject } from "@/lib/projects";

async function post(url: string, body: unknown, method = "POST") {
  try { const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { ok: r.ok, body: await r.json().catch(() => ({})) }; }
  catch { return { ok: false, body: { error: "Could not reach Eclipse. Check your connection." } }; }
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="mt-scrim" onClick={onClose}>
      <div className={`mt-modal${wide ? " is-wide" : ""}`} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="mt-row"><b className="mt-modal-h">{title}</b><span className="mt-grow" /><button type="button" className="mt-icon" aria-label="Close" onClick={onClose}><X size={16} /></button></div>
        {children}
      </div>
    </div>
  );
}

/* ---------------- Brand kits: choose, create (files, website, text, by hand), add an example ---------------- */

export function BrandKitDialog({ kits, reload, chosen, onChoose, onClose, addVersion }: { kits: BrandKitItem[]; reload: () => Promise<void>; chosen: string | null; onChoose: (id: string | null) => void; onClose: () => void; addVersion?: string }) {
  const [creating, setCreating] = useState(false), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState<string | null>(null);
  async function add(id: string) {
    setBusy(id); const r = await post(`/api/design/brand-kits/${id}`, { addVersion }, "PATCH"); setBusy(null);
    if (r.ok) { await reload(); onChoose(id); } else setError(r.body.error ?? "It could not be added.");
  }
  return (
    <Modal title={addVersion ? "Add to brand kit" : "Brand kit"} onClose={onClose} wide>
      {addVersion && <p className="mt-hint">It becomes an example in the kit: new motions with this kit follow how it moves.</p>}
      {creating ? <CreateKit onDone={async (id) => { setCreating(false); await reload(); if (!addVersion) onChoose(id); }} onCancel={() => setCreating(false)} /> : (
        <>
          <div className="mt-row"><span className="mt-hint">{kits.length ? "Choose a kit so the motion uses its colours, fonts, logo and motion style." : "No brand kits yet."}</span><span className="mt-grow" /><button type="button" className="mt-go" onClick={() => setCreating(true)}><Plus size={14} />Create</button></div>
          <div className="mt-kits">
            {!addVersion && <button type="button" className={`mt-kit${chosen === null ? " is-on" : ""}`} onClick={() => onChoose(null)}><span className="mt-kit-art is-none">None</span><b>No brand kit</b><em>The agent picks the look</em></button>}
            {kits.map((k) => (
              <div key={k.id} className={`mt-kit${chosen === k.id ? " is-on" : ""}`}>
                <button type="button" className="mt-kit-pick" onClick={() => (addVersion ? add(k.id) : onChoose(k.id))} aria-label={`${addVersion ? "Add to" : "Use"} ${k.name}`}>
                  <span className="mt-kit-art" style={{ background: k.colors[0] ?? "#111", color: k.colors[1] ?? "#fff" }}><b>Aa</b><span className="mt-swatches">{k.colors.slice(0, 6).map((c) => <i key={c} style={{ background: c }} />)}</span></span>
                  <b>{k.name}{busy === k.id && <Loader2 size={12} className="mt-spin" />}</b>
                  <em>{k.colors.length} colours · {k.fonts.display} · {k.logos.length} logo{k.logos.length === 1 ? "" : "s"} · {k.examples.length} example{k.examples.length === 1 ? "" : "s"}</em>
                </button>
                {chosen === k.id && <Check size={14} className="mt-kit-check" />}
                <button type="button" className="mt-kit-del" aria-label={`Delete ${k.name}`} onClick={async () => { if (confirm(`Delete the brand kit "${k.name}"?`)) { await fetch(`/api/design/brand-kits/${k.id}`, { method: "DELETE" }); if (chosen === k.id) onChoose(null); await reload(); } }}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </>
      )}
      {error && <p className="mt-error" role="alert">{error}</p>}
    </Modal>
  );
}

function CreateKit({ onDone, onCancel }: { onDone: (id: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(""), [mode, setMode] = useState<"files" | "website" | "text" | "manual">("manual");
  const [url, setUrl] = useState(""), [text, setText] = useState(""), [logos, setLogos] = useState<RefPick[]>([]), [picker, setPicker] = useState(false);
  const [colors, setColors] = useState<string[]>(["#0b0b0d", "#ffffff", "#c00707"]), [display, setDisplay] = useState("Inter"), [body, setBody] = useState("Inter"), [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  async function save() {
    setBusy(true); setError(null);
    const base = { name: name.trim(), logos: logos.map((l) => ({ type: l.type, id: l.id })) };
    const r = await post("/api/design/brand-kits", mode === "website" ? { ...base, fromUrl: url.trim() } : mode === "text" ? { ...base, fromText: text } : { ...base, colors, fonts: { display, body }, notes });
    setBusy(false);
    if (r.ok) onDone(r.body.id); else setError(r.body.error ?? "The kit could not be made.");
  }
  const can = mode === "website" ? !!url.trim() : mode === "text" ? !!text.trim() : !!name.trim();
  return (
    <div className="mt-create">
      <label className="mt-field"><span>Brand name {mode === "manual" || mode === "files" ? "(required)" : "(optional)"}</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Corp" /></label>
      <div className="mt-sources" role="tablist" aria-label="Brand source">
        {([["files", ImageIcon, "Files"], ["website", Globe, "Website"], ["text", FileText, "Text"], ["manual", Plus, "By hand"]] as const).map(([k, Icon, label]) => (
          <button key={k} role="tab" aria-selected={mode === k} type="button" className={mode === k ? "is-on" : ""} onClick={() => setMode(k)}><Icon size={15} />{label}</button>
        ))}
      </div>
      {mode === "website" && <label className="mt-field"><span>Website address</span><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-brand.com" inputMode="url" /></label>}
      {mode === "text" && <label className="mt-field"><span>Paste your brand notes (colours, fonts, tone)</span><GrowArea rows={4} maxLines={10} value={text} onChange={(e) => setText(e.target.value)} placeholder="Our colours are deep teal #0f4c5c and sand #e8d9c4…" /></label>}
      {(mode === "files" || mode === "manual") && (
        <>
          <div className="mt-field"><span>Logos and brand pictures</span><div className="mt-pics">{logos.map((l) => <span key={l.id} className="mt-pic">{/* eslint-disable-next-line @next/next/no-img-element -- plain img */}<img src={l.url} alt={l.label} /><button type="button" aria-label="Remove" onClick={() => setLogos(logos.filter((x) => x.id !== l.id))}><X size={11} /></button></span>)}
            {logos.length < 4 && <button type="button" className="mt-pic mt-pic-add" onClick={() => setPicker(true)} aria-label="Add a logo"><Plus size={16} /></button>}</div></div>
        </>
      )}
      {mode === "manual" && (
        <>
          <div className="mt-field"><span>Colours (background, text, accents)</span><div className="mt-colors">
            {colors.map((c, i) => <span key={i} className="mt-color"><input type="color" value={c} aria-label={`Colour ${i + 1}`} onChange={(e) => setColors(colors.map((x, j) => (j === i ? e.target.value : x)))} />{colors.length > 1 && <button type="button" aria-label={`Remove colour ${i + 1}`} onClick={() => setColors(colors.filter((_, j) => j !== i))}><X size={10} /></button>}</span>)}
            {colors.length < 6 && <button type="button" className="mt-color-add" aria-label="Add a colour" onClick={() => setColors([...colors, "#888888"])}><Plus size={14} /></button>}
          </div></div>
          <div className="mt-row">
            <label className="mt-field"><span>Headline font</span><select value={display} onChange={(e) => setDisplay(e.target.value)}>{FONT_FAMILIES.map((f) => <option key={f}>{f}</option>)}</select></label>
            <label className="mt-field"><span>Body font</span><select value={body} onChange={(e) => setBody(e.target.value)}>{FONT_FAMILIES.map((f) => <option key={f}>{f}</option>)}</select></label>
          </div>
          <label className="mt-field"><span>Tone and motion style (optional)</span><GrowArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Confident and minimal. Fast cuts, crisp easing, lots of white space." /></label>
        </>
      )}
      {error && <p className="mt-error" role="alert">{error}</p>}
      <div className="mt-row"><span className="mt-grow" /><button type="button" className="mt-chip" onClick={onCancel}>Cancel</button><button type="button" className="mt-go" disabled={!can || busy} onClick={save}>{busy && <Loader2 size={14} className="mt-spin" />}{mode === "website" || mode === "text" ? "Read and create" : "Create kit"}</button></div>
      {picker && <ReferencePicker max={4} picked={logos} onChange={setLogos} onClose={() => setPicker(false)} />}
    </div>
  );
}

/* ---------------- Download: rendered here, frame by frame, saved to the Library and to the device ---------------- */

export function DownloadDialog({ title, version, clips = [], host, onClose }: { title: string; version: MotionVersionItem; clips?: MotionClip[]; host: () => MotionHost | null; onClose: () => void }) {
  const [short, setShort] = useState<1080 | 2160>(1080), [fps, setFps] = useState<24 | 30 | 60>(30), [blur, setBlur] = useState(false), [keep, setKeep] = useState(true);
  const [prog, setProg] = useState<number | null>(null), [error, setError] = useState<string | null>(null), [done, setDone] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const { w, h } = pixelSize(version.aspect, short);
  const frames = Math.round(version.duration * fps) * (blur ? 4 : 1);
  async function go() {
    const hst = host(); if (!hst) { setError("The preview is not ready."); return; }
    setError(null); setDone(null); setProg(0); abort.current = new AbortController();
    try {
      const blob = await exportMotion(hst, version, { short, fps, blur, clips, signal: abort.current.signal, onProgress: (d, t) => setProg(d / t) });
      const name = fileName(title, version);
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
      if (keep) {
        const r = await uploadVideo(new File([blob], name, { type: "video/mp4" }), `${title} v${version.n}`, readCurrentProject()?.id ?? null);
        setDone(r.ok ? "Downloaded and saved to your Library." : `Downloaded. It could not be saved to the Library: ${r.error}`);
      } else setDone("Downloaded.");
    } catch (e) { setError(e instanceof Error ? e.message : "The video could not be made."); }
    setProg(null);
  }
  return (
    <Modal title={`Download v${version.n}`} onClose={() => { abort.current?.abort(); onClose(); }}>
      <div className="mt-dl">
        <span>Resolution</span><div className="mt-seg">{([1080, 2160] as const).map((s) => <button key={s} type="button" className={short === s ? "is-on" : ""} onClick={() => setShort(s)} disabled={prog !== null}>{s === 1080 ? "1080p" : "4K"}</button>)}</div>
        <span>Frame rate</span><div className="mt-seg">{([24, 30, 60] as const).map((f) => <button key={f} type="button" className={fps === f ? "is-on" : ""} onClick={() => setFps(f)} disabled={prog !== null}>{f}</button>)}</div>
        <span>Motion blur</span><label className="mt-switch"><span><em>Smoother motion. Takes longer.</em></span><input type="checkbox" checked={blur} onChange={(e) => setBlur(e.target.checked)} disabled={prog !== null} /></label>
        <span>Library</span><label className="mt-switch"><span><em>Also save it to your Library.</em></span><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} disabled={prog !== null} /></label>
      </div>
      <p className="mt-hint">{w} x {h} · {version.duration}s · {frames.toLocaleString()} frames drawn on this device, no credits used.</p>
      {prog !== null && <div className="mt-bar" role="progressbar" aria-valuenow={Math.round(prog * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${prog * 100}%` }} /><span>{Math.round(prog * 100)}%</span></div>}
      {error && <p className="mt-error" role="alert">{error}</p>}
      {done && <p className="mt-note" role="status">{done}</p>}
      <div className="mt-row"><span className="mt-grow" />{prog !== null ? <button type="button" className="mt-chip" onClick={() => abort.current?.abort()}>Cancel</button> : <button type="button" className="mt-chip" onClick={onClose}>Close</button>}<button type="button" className="mt-go" disabled={prog !== null} onClick={go}>{prog !== null ? <Loader2 size={14} className="mt-spin" /> : null}Download</button></div>
    </Modal>
  );
}
