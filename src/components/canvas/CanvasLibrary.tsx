"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Image as ImageIcon, Loader2, MoreHorizontal, Pencil, Plus, RotateCcw, Trash2, Workflow } from "lucide-react";
import { createCanvas, deleteCanvasForever, duplicateCanvas, listCanvases, renameCanvas, restoreCanvas, trashCanvas, type CanvasMeta } from "@/lib/canvas-store";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { readCurrentProject } from "@/lib/projects";
import "./canvas-library.css";

function ago(t: number): string {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return new Date(t).toLocaleDateString();
}

// The canvases of the open project: open one to carry on where you left off, start a new one, rename, duplicate, delete (to Recently deleted, where it can be restored).
export default function CanvasLibrary({ projectId, onOpen }: { projectId: string; onOpen: (id: string) => void }) {
  const [tab, setTab] = useState<"canvases" | "bin">("canvases");
  const [items, setItems] = useState<CanvasMeta[] | null>(null);
  const [binCount, setBinCount] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [confirm, setConfirm] = useState<CanvasMeta | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const live = await listCanvases(projectId, false); // first: it is the call that brings an older canvas into the library
      const bin = await listCanvases(projectId, true);
      setItems(tab === "bin" ? bin : live);
      setBinCount(bin.length);
    } catch { setItems([]); setError("Could not load your canvases."); }
  }, [projectId, tab]);
  useEffect(() => { setItems(null); void load(); }, [load]);

  // Close the card menu on any outside click.
  useEffect(() => {
    if (!menu) return;
    const off = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest(".cl-menu, .cl-more")) setMenu(null); };
    window.addEventListener("mousedown", off);
    return () => window.removeEventListener("mousedown", off);
  }, [menu]);

  async function run(id: string, f: () => Promise<unknown>) {
    setBusy(id); setError(""); setMenu(null);
    try { await f(); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong. Please try again."); } finally { setBusy(null); }
  }

  async function startNew() {
    setBusy("new"); setError("");
    try {
      const n = (await listCanvases(projectId, false)).length;
      const meta = await createCanvas(projectId, `Canvas ${n + 1}`);
      if (meta) onOpen(meta.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create the canvas."); setBusy(null); }
  }

  const projectName = readCurrentProject()?.name;
  const thumb = (m: CanvasMeta) => (clerkEnabled && m.thumbId ? `/api/generations/${m.thumbId}/file` : null);

  return (
    <div className="cl-wrap" ref={root}>
      <header className="cl-head">
        <div>
          <h1 className="pg-title">Canvases</h1>
          <p>{projectName ? <>Everything you built in <b>{projectName}</b>. Open one to carry on exactly where you left off.</> : "Open one to carry on exactly where you left off."}</p>
        </div>
        <button type="button" className="cl-new" onClick={startNew} disabled={busy === "new"}>{busy === "new" ? <Loader2 size={16} className="cv-spin" /> : <Plus size={16} />} New canvas</button>
      </header>

      <div className="cl-tabs" role="tablist" aria-label="Canvas lists">
        <button type="button" role="tab" aria-selected={tab === "canvases"} className={tab === "canvases" ? "is-active" : ""} onClick={() => setTab("canvases")}>Canvases</button>
        <button type="button" role="tab" aria-selected={tab === "bin"} className={tab === "bin" ? "is-active" : ""} onClick={() => setTab("bin")}>Recently deleted{binCount > 0 ? ` (${binCount})` : ""}</button>
      </div>

      {error && <p className="cl-error" role="alert">{error}</p>}

      {items === null ? <p className="cl-note"><Loader2 size={14} className="cv-spin" /> Loading your canvases…</p>
        : items.length === 0 ? (
          tab === "bin" ? <p className="cl-note">Nothing here. A canvas you delete waits here until you delete it for good, and can be restored until then.</p>
            : <div className="cl-empty"><Workflow size={30} strokeWidth={1.4} /><b>No canvases yet</b><p>A canvas is a board of nodes: prompts, characters, products and styles wired into image generators. Start one and it is saved here for good.</p><button type="button" className="cl-new" onClick={startNew}><Plus size={16} /> New canvas</button></div>
        ) : (
          <ul className="cl-grid">
            {items.map((m) => (
              <li key={m.id} className={`cl-card ${busy === m.id ? "is-busy" : ""}`}>
                <button type="button" className="cl-open" onClick={() => (tab === "bin" ? undefined : onOpen(m.id))} disabled={tab === "bin" || busy === m.id} aria-label={tab === "bin" ? m.name : `Open ${m.name}`}>
                  <span className="cl-thumb">
                    {thumb(m) ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={thumb(m)!} alt="" loading="lazy" />
                      </>
                    ) : <Workflow size={28} strokeWidth={1.3} />}
                  </span>
                </button>
                <div className="cl-info">
                  {renaming?.id === m.id ? (
                    <input className="cl-rename" autoFocus value={renaming.name} maxLength={60} aria-label="Canvas name"
                      onChange={(e) => setRenaming({ id: m.id, name: e.target.value })}
                      onBlur={() => { const r = renaming; setRenaming(null); if (r && r.name.trim() && r.name.trim() !== m.name) void run(m.id, () => renameCanvas(projectId, m.id, r.name)); }}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setRenaming(null); }} />
                  ) : <b title={m.name}>{m.name}</b>}
                  <span>{m.nodeCount} {m.nodeCount === 1 ? "node" : "nodes"} · {tab === "bin" && m.deletedAt ? `deleted ${ago(m.deletedAt)}` : `edited ${ago(m.updatedAt)}`}</span>
                </div>
                {tab === "bin" ? (
                  <div className="cl-binbtns">
                    <button type="button" onClick={() => run(m.id, () => restoreCanvas(projectId, m.id))} disabled={busy === m.id}><RotateCcw size={14} /> Restore</button>
                    <button type="button" className="is-danger" onClick={() => setConfirm(m)} disabled={busy === m.id}><Trash2 size={14} /> Delete forever</button>
                  </div>
                ) : (
                  <>
                    <button type="button" className="cl-more" aria-label={`More for ${m.name}`} aria-haspopup="menu" aria-expanded={menu === m.id} onClick={() => setMenu(menu === m.id ? null : m.id)}><MoreHorizontal size={16} /></button>
                    {menu === m.id && (
                      <div className="cl-menu" role="menu">
                        <button type="button" role="menuitem" onClick={() => { setMenu(null); setRenaming({ id: m.id, name: m.name }); }}><Pencil size={14} /> Rename</button>
                        <button type="button" role="menuitem" onClick={() => run(m.id, () => duplicateCanvas(projectId, m.id))}><Copy size={14} /> Duplicate</button>
                        <button type="button" role="menuitem" className="is-danger" onClick={() => run(m.id, () => trashCanvas(projectId, m.id))}><Trash2 size={14} /> Delete</button>
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      {tab === "canvases" && items && items.length > 0 && <p className="cl-note cl-foot"><ImageIcon size={13} /> Pictures a canvas made stay in your Library even if you delete the canvas.</p>}

      {confirm && (
        <div className="cl-scrim" onClick={() => setConfirm(null)}>
          <div className="cl-dialog" role="alertdialog" aria-modal="true" aria-label="Delete canvas for good" onClick={(e) => e.stopPropagation()}>
            <h2>Delete &ldquo;{confirm.name}&rdquo; for good?</h2>
            <p>This removes the canvas and its wiring. It cannot be undone. Pictures it made stay in your Library.</p>
            <div>
              <button type="button" onClick={() => setConfirm(null)}>Cancel</button>
              <button type="button" className="is-danger" onClick={() => { const m = confirm; setConfirm(null); void run(m.id, () => deleteCanvasForever(projectId, m.id)); }}>Delete forever</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
