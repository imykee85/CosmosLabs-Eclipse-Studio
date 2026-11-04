"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Columns2, Download, FileArchive, Layers, Loader2, Maximize2, RefreshCw, Shapes, X, ZoomIn } from "lucide-react";
import GenerateButton from "@/components/GenerateButton";
import SheetPortal from "@/components/voice/SheetPortal";
import VariationsForm from "./VariationsForm";
import { useModels } from "@/lib/use-models";
import { refreshCredits, useCredits } from "@/lib/use-credits";
import { imageCost, startImages, tierResolution, type RefId } from "@/lib/image-render";
import { toolModel } from "@/lib/picture-tools";
import { readCurrentProject } from "@/lib/projects";
import { thumbOf } from "@/lib/thumb-url";
import { createCanvas } from "@/lib/canvas-store";
import { newNode } from "@/lib/canvas";
import { zipStore } from "@/lib/zip";
import { FEATURE_NAME, cellPrompts, gridCount, initialState, problem, parseScenes, ratioChoices, type VarState } from "@/lib/variations/prompt";

type Cell = { id: string | null; status: "pending" | "completed" | "failed"; error?: string };

/** Variations as a window: pick a mode and options, make one picture per cell from the reference, then follow them, see the contact sheet and use the results. */
export default function VariationsTool({ reference, onClose, onUseAsReference, onUpscale }: {
  reference: RefId; onClose: () => void; onUseAsReference?: (id: string) => void; onUpscale?: (id: string) => void;
}) {
  const models = useModels({ edit: true });
  const { credits } = useCredits();
  const model = useMemo(() => (models ? toolModel(models, "camera") : null), [models]);
  const tiers = useMemo(() => (model ? ["1k", ...(model.resolutions.includes("1080p") ? ["1.5k"] : []), ...(model.resolutions.includes("2k") ? ["2k"] : []), ...(model.resolutions.includes("4k") ? ["4k"] : [])] : ["1k"]), [model]);
  const ratios = useMemo(() => ratioChoices(model?.ratios ?? []), [model]);
  const [s, setS] = useState<VarState>(initialState);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [storyBusy, setStoryBusy] = useState(false);
  const [error, setError] = useState("");
  const [cells, setCells] = useState<Cell[] | null>(null);
  const [sheet, setSheet] = useState<{ id?: string; busy: boolean; error: string }>({ busy: false, error: "" });
  const [view, setView] = useState<{ id: string; sheet?: boolean } | null>(null);
  const [compare, setCompare] = useState(false);
  const [note, setNote] = useState("");
  const [made, setMade] = useState<{ s: VarState; grid: string } | null>(null);
  const n = gridCount(s.grid);
  const tier = tiers.includes(s.tier) ? s.tier : tiers.includes("2k") ? "2k" : tiers[tiers.length - 1] ?? "1k";
  const unit = model ? imageCost(model, model.resolutions.length ? tierResolution(model.resolutions, tier) : undefined, 1) : null;
  const issue = problem(s, consent);
  const refThumb = thumbOf(reference.type, reference.id);

  useEffect(() => { // keep the quality valid for the model once it is known
    setS((x) => (tiers.includes(x.tier) ? x : { ...x, tier: tiers.includes("2k") ? "2k" : tiers[tiers.length - 1] ?? "1k" }));
    setS((x) => (ratios.includes(x.ratio) ? x : { ...x, ratio: "auto" }));
  }, [tiers, ratios]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { if (view) setView(null); else onClose(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose, view]);

  async function writeStory(quiet = false): Promise<string[] | null> {
    setStoryBusy(true); if (!quiet) setError("");
    try {
      const res = await fetch("/api/variations/narrative", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ n, hint: "", picture: reference }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(d.scenes)) throw new Error(d.error ?? "The story could not be written. Please try again.");
      const text = (d.scenes as string[]).map((t, i) => `Scene ${i + 1}: ${t}`).join("\n");
      setS((x) => ({ ...x, narrative: text }));
      return d.scenes as string[];
    } catch (e) {
      if (!quiet) setError(e instanceof Error ? e.message : "The story could not be written. Please try again.");
      return null;
    } finally { setStoryBusy(false); }
  }

  async function run() {
    if (!model || busy || issue) return;
    setBusy(true); setError("");
    try {
      let state = { ...s, tier };
      // Storyboard on Auto: write the story first and show it, so the person can edit it next time
      if (state.mode === "storyboard" && state.auto && parseScenes(state.narrative).length !== n) {
        const scenes = await writeStory(true); // if it cannot be written (no chat credits on a free trial), the built-in run of shots is used
        if (scenes) state = { ...state, narrative: scenes.map((t, i) => `Scene ${i + 1}: ${t}`).join("\n") };
      }
      const prompts = cellPrompts(state);
      // one seed for every cell where the model has a seed, so the cells stay related
      const seedOn = model.seed.supported;
      const seedNum = seedOn ? model.seed.min + Math.floor(Math.random() * Math.min(model.seed.max - model.seed.min, 999_999)) : null;
      const projectId = readCurrentProject()?.id;
      const out = await Promise.all(prompts.map(async (prompt): Promise<Cell> => {
        try {
          const { results } = await startImages({ models: models ?? [], model, auto: false, prompt, ratio: state.ratio, tier, qty: 1, refs: [reference], seedOn, seedNum, projectId });
          const r = results[0];
          return r?.ok && r.id ? { id: r.id, status: "pending" } : { id: null, status: "failed", error: r?.error ?? "Something went wrong." };
        } catch (e) { return { id: null, status: "failed", error: e instanceof Error ? e.message : "Something went wrong." }; }
      }));
      refreshCredits();
      if (!out.some((c) => c.id)) throw new Error(out.find((c) => c.error)?.error ?? "Something went wrong. Please try again.");
      setMade({ s: state, grid: state.grid });
      setSheet({ busy: false, error: "" });
      setCells(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally { setBusy(false); }
  }

  // follow the cells until each has finished or failed
  useEffect(() => {
    if (!cells || cells.every((c) => c.status !== "pending")) return;
    let live = true;
    const t = setInterval(async () => {
      const next = await Promise.all(cells.map(async (c): Promise<Cell> => {
        if (c.status !== "pending" || !c.id) return c;
        try {
          const r = await fetch(`/api/generations/${c.id}`);
          const d = await r.json().catch(() => ({}));
          if (!r.ok) return c;
          if (d.status === "completed") return { id: c.id, status: "completed" };
          if (d.status === "failed") return { id: c.id, status: "failed", error: d.error ?? "This one could not be made." };
        } catch {}
        return c;
      }));
      if (live) setCells(next);
    }, 3000);
    return () => { live = false; clearInterval(t); };
  }, [cells]);

  const done = cells?.filter((c) => c.status === "completed" && c.id) ?? [];
  const settled = !!cells && cells.every((c) => c.status !== "pending");
  const makeSheet = useCallback(async () => {
    if (!cells) return;
    const ids = cells.filter((c) => c.status === "completed" && c.id).map((c) => c.id as string);
    if (ids.length < 2) return;
    setSheet({ busy: true, error: "" });
    try {
      const res = await fetch("/api/variations/sheet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, grid: made?.grid ?? s.grid, mode: made?.s.mode, referenceId: reference.id }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || typeof d.id !== "string") throw new Error(d.error ?? "The sheet could not be made.");
      setSheet({ id: d.id, busy: false, error: "" });
    } catch (e) { setSheet({ busy: false, error: e instanceof Error ? e.message : "The sheet could not be made." }); }
  }, [cells, reference.id, s.grid, made]);
  useEffect(() => { if (settled && done.length >= 2 && !sheet.id && !sheet.busy && !sheet.error) void makeSheet(); }, [settled, done.length, sheet, makeSheet]);

  const file = (id: string, dl = false) => `/api/generations/${id}/file${dl ? "?download=1" : ""}`;
  function save(href: string, name: string) { const a = document.createElement("a"); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  async function downloadAll() {
    setNote("Getting your pictures…");
    try {
      const files = await Promise.all(done.map(async (c, i) => {
        const r = await fetch(file(c.id as string, true));
        if (!r.ok) throw new Error("download");
        const type = r.headers.get("content-type") ?? "";
        return { name: `variation-${i + 1}.${/jpeg/.test(type) ? "jpg" : /webp/.test(type) ? "webp" : "png"}`, data: new Uint8Array(await r.arrayBuffer()) };
      }));
      const url = URL.createObjectURL(new Blob([zipStore(files) as BlobPart], { type: "application/zip" }));
      save(url, "variations.zip"); setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setNote("");
    } catch { setNote("The pictures could not be downloaded. Please try again."); }
  }
  async function toCanvas(ids: string[]) {
    const projectId = readCurrentProject()?.id;
    if (!projectId) { setNote("Open a project first."); return; }
    setNote("Making a canvas…");
    const nodes = ids.map((id, i) => newNode("image", { x: (i % 3) * 340, y: Math.floor(i / 3) * 420 }, { ref: { type: "render", id, label: `Variation ${i + 1}` } }));
    try {
      const meta = await createCanvas(projectId, "Variations", { nodes, edges: [], viewport: null });
      if (meta) window.location.assign(`/canvas?c=${meta.id}`); else setNote("The canvas could not be made.");
    } catch (e) { setNote(e instanceof Error ? e.message : "The canvas could not be made."); }
  }

  const [rows, cols] = (made?.grid ?? s.grid).split("x").map(Number);
  const label = (m: string) => MODE_LABEL[m] ?? "Variations";
  return (
    <SheetPortal>
      <div className="cr-var-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="cr-var cr-vars" role="dialog" aria-modal="true" aria-label={FEATURE_NAME}>
          <div className="cr-var-head">
            {cells && <button type="button" className="cr-var-x" style={{ marginLeft: 0 }} onClick={() => { setCells(null); setSheet({ busy: false, error: "" }); }} aria-label="Back to the settings"><ArrowLeft size={18} /></button>}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={refThumb} alt="" className="cr-var-thumb" />
            <div><h2>{FEATURE_NAME}</h2><p>{cells ? `${label(made?.s.mode ?? "")}, ${made?.grid}` : "One picture, a set of controlled versions"}</p></div>
            <button type="button" className="cr-var-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
          </div>

          {!cells && (<>
            <VariationsForm s={{ ...s, tier }} setS={setS} consent={consent} setConsent={setConsent} tiers={tiers} ratios={ratios} storyBusy={storyBusy} onWriteStory={() => void writeStory()} />
            {(issue || error) && <div className="cr-var-err">{error || issue}</div>}
            {models && !model && <div className="cr-var-err">Variations needs a model that edits pictures, and none is connected yet.</div>}
            <GenerateButton wide price={unit != null ? unit * n : null} free={unit != null && (credits?.freeImages ?? 0) >= n} busy={busy} disabled={!!issue || !model} onClick={() => void run()} />
          </>)}

          {cells && (<>
            <div className="cr-vars-cells" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }} aria-label={`${rows} by ${cols} variations`}>
              {cells.map((c, i) => (
                <button key={i} type="button" className={`cr-vars-cell is-${c.status}`} disabled={c.status !== "completed"} onClick={() => c.id && setView({ id: c.id })} aria-label={`Variation ${i + 1}`} title={c.error}>
                  {c.status === "completed" && c.id ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={thumbOf("render", c.id)} alt="" />
                    : c.status === "pending" ? <Loader2 size={22} className="gen-spin" /> : <span>{c.error ?? "Failed"}</span>}
                </button>
              ))}
            </div>
            {!settled && <p className="cr-vars-hint">Making {cells.filter((c) => c.status === "pending").length} of {cells.length}… You can close this; they keep rendering and land in your Gallery.</p>}
            {settled && cells.some((c) => c.status === "failed") && <div className="cr-var-err">{cells.filter((c) => c.status === "failed").length} of {cells.length} could not be made{cells.find((c) => c.error)?.error ? `: ${cells.find((c) => c.error)?.error}` : ""}. Nothing was charged for those.</div>}
            {settled && done.length >= 2 && (
              <div className="cr-vars-acts">
                <button type="button" disabled={!sheet.id} onClick={() => sheet.id && setView({ id: sheet.id, sheet: true })}>{sheet.busy ? <Loader2 size={14} className="gen-spin" /> : <Layers size={14} />} Open the sheet</button>
                <button type="button" disabled={!sheet.id} onClick={() => sheet.id && save(file(sheet.id, true), "variations-sheet.jpg")}><Download size={14} /> Sheet</button>
                <button type="button" onClick={() => void downloadAll()}><FileArchive size={14} /> Download all</button>
                <button type="button" onClick={() => void toCanvas(done.map((c) => c.id as string))}><Shapes size={14} /> Send to canvas</button>
                {sheet.error && <button type="button" onClick={() => setSheet({ busy: false, error: "" })}><RefreshCw size={14} /> Try the sheet again</button>}
              </div>
            )}
            {note && <p className="cr-vars-hint" role="status">{note}</p>}
          </>)}
        </div>
      </div>

      {view && (
        <div className="cr-vars-view" role="dialog" aria-modal="true" aria-label="Variation" onMouseDown={(e) => { if (e.target === e.currentTarget) setView(null); }}>
          <div className={`cr-vars-viewbox${compare && !view.sheet ? " is-compare" : ""}`}>
            {compare && !view.sheet && /* eslint-disable-next-line @next/next/no-img-element */ <img src={reference.type === "upload" ? `/api/uploads/${reference.id}/file` : file(reference.id)} alt="Your original" />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={file(view.id)} alt={view.sheet ? "The whole sheet" : "Variation"} />
          </div>
          <div className="cr-vars-viewbar">
            {!view.sheet && <button type="button" className={compare ? "is-on" : ""} onClick={() => setCompare((v) => !v)}><Columns2 size={14} /> Compare</button>}
            <button type="button" onClick={() => save(file(view.id, true), view.sheet ? "variations-sheet.jpg" : "variation.png")}><Download size={14} /> Download</button>
            {!view.sheet && onUseAsReference && <button type="button" onClick={() => { onUseAsReference(view.id); onClose(); }}><Maximize2 size={14} /> Use as new reference</button>}
            {!view.sheet && onUpscale && <button type="button" onClick={() => { onUpscale(view.id); onClose(); }}><ZoomIn size={14} /> Upscale</button>}
            {!view.sheet && <button type="button" onClick={() => void toCanvas([view.id])}><Shapes size={14} /> Canvas</button>}
            <button type="button" onClick={() => setView(null)}><X size={14} /> Close</button>
          </div>
        </div>
      )}
    </SheetPortal>
  );
}

const MODE_LABEL: Record<string, string> = { reframe: "Reframe", storyboard: "Storyboard", people: "People", custom: "Custom" };
