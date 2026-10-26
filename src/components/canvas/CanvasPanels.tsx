"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, MessageSquareText, Trash2, X } from "lucide-react";
import { clerkEnabled } from "@/lib/clerk-enabled";
import type { CanvasSettings, EdgeStyle } from "@/lib/canvas-settings";
import type { CanvasComment } from "@/lib/use-canvas-comments";

// The share, comments and settings panels of the canvas editor. They are drawn by CanvasView outside the zoomed layer.

export const SHORTCUTS: [string, string][] = [
  ["Ctrl or Cmd + Z", "Undo"],
  ["Shift + Ctrl or Cmd + Z, or Ctrl + Y", "Redo"],
  ["N", "Open the node list"],
  ["V", "Select mode: drag a box round nodes"],
  ["H", "Pan mode: drag to move the board"],
  ["Shift, Ctrl or Cmd + click", "Add a node to the selection"],
  ["Ctrl or Cmd + G", "Group the selected nodes"],
  ["Delete or Backspace", "Delete the selected nodes (with Undo)"],
  ["Double-tap a node", "Zoom in on it; double-tap again to zoom out"],
  ["Esc", "Close a panel or leave full screen"],
];

export function SettingsModal({ settings, onChange, onClose }: { settings: CanvasSettings; onChange: (p: Partial<CanvasSettings>) => void; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="cv-modal-back" onClick={onClose}>
      <div className="cv-modal" role="dialog" aria-modal="true" aria-label="Canvas settings" onClick={(e) => e.stopPropagation()}>
        <header><b>Canvas settings</b><button type="button" aria-label="Close" onClick={onClose}><X size={16} /></button></header>
        <div className="cv-modal-body">
          <section>
            <label className="cv-set">
              <span><b>Helper lines</b><small>Lines and snapping that line a node up with its neighbours while you drag it.</small></span>
              <button type="button" role="switch" aria-checked={settings.helperLines} aria-label="Helper lines" className={`cv-switch ${settings.helperLines ? "is-on" : ""}`} onClick={() => onChange({ helperLines: !settings.helperLines })}><i /></button>
            </label>
            <label className="cv-set">
              <span><b>Wire style</b><small>The shape of the wires between nodes.</small></span>
              <select className="cv-ctl cv-ctl-select" value={settings.edge} aria-label="Wire style" onChange={(e) => onChange({ edge: e.target.value as EdgeStyle })}>
                <option value="bezier">Curved</option><option value="smoothstep">Rounded corners</option><option value="step">Square corners</option><option value="straight">Straight</option>
              </select>
            </label>
            <label className="cv-set">
              <span><b>Mouse wheel</b><small>What scrolling does. Pinching always zooms.</small></span>
              <select className="cv-ctl cv-ctl-select" value={settings.wheel} aria-label="Mouse wheel" onChange={(e) => onChange({ wheel: e.target.value === "pan" ? "pan" : "zoom" })}>
                <option value="zoom">Zoom the board</option><option value="pan">Move the board</option>
              </select>
            </label>
          </section>
          <section>
            <h3>Shortcuts</h3>
            <dl className="cv-keys">
              {SHORTCUTS.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}

// Anyone with the link can LOOK at the canvas as it is now (nothing can be changed, nothing costs them credits). Turning it off kills the old address.
export function SharePanel({ canvasId, onClose }: { canvasId: string; onClose: () => void }) {
  const [state, setState] = useState<{ enabled: boolean; path: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!clerkEnabled) { setState({ enabled: false, path: null }); return; }
    let live = true;
    fetch(`/api/canvases/${canvasId}/share`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (live) setState(d ?? { enabled: false, path: null }); }).catch(() => { if (live) setState({ enabled: false, path: null }); });
    return () => { live = false; };
  }, [canvasId]);
  async function toggle() {
    if (busy || !state) return;
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/canvases/${canvasId}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !state.enabled }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof d.error === "string" ? d.error : "Could not change the link.");
      setState(d);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not change the link."); }
    finally { setBusy(false); }
  }
  const url = state?.path ? `${window.location.origin}${state.path}` : "";
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setError("Copy the link from the box."); }
  }
  return (
    <div className="cv-pop" role="dialog" aria-label="Share">
      <header><b>Share</b><button type="button" aria-label="Close" onClick={onClose}><X size={16} /></button></header>
      <div className="cv-pop-body">
        {!clerkEnabled ? <p className="cv-none">Sharing needs an account. Sign in to get a link.</p> : (
          <section>
            <label className="cv-set">
              <span><b>Anyone with the link can view</b><small>They see the board as it is now and cannot change it.</small></span>
              <button type="button" role="switch" aria-checked={!!state?.enabled} aria-label="Anyone with the link can view" disabled={!state || busy} className={`cv-switch ${state?.enabled ? "is-on" : ""}`} onClick={() => void toggle()}><i /></button>
            </label>
            {state?.enabled && (
              <div className="cv-save">
                <input readOnly value={url} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
                <button type="button" onClick={() => void copy()}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}</button>
              </div>
            )}
            {state?.enabled && <p className="cv-nhint"><Link2 size={12} /> Turning this off stops the link working at once.</p>}
            {error && <p className="cv-error" role="alert">{error}</p>}
          </section>
        )}
      </div>
    </div>
  );
}

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  return s < 60 ? "just now" : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : `${Math.floor(s / 86400)} d ago`;
};

export function CommentsPanel({ items, error, enabled, add, resolve, remove, selected, label, onFocusNode, onClose }: {
  items: CanvasComment[]; error: string; enabled: boolean; add: (text: string, nodeId: string | null) => Promise<boolean>; resolve: (id: string, r: boolean) => void; remove: (id: string) => void;
  selected: { id: string; title: string } | null; label: (nodeId: string) => string | null; onFocusNode: (id: string) => void; onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [onNode, setOnNode] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const open = items.filter((c) => !c.resolved);
  const done = items.filter((c) => c.resolved);
  async function send() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    const ok = await add(t, selected && onNode ? selected.id : null);
    setBusy(false);
    if (ok) setText("");
  }
  const row = (c: CanvasComment) => {
    const where = c.nodeId ? label(c.nodeId) : null;
    return (
      <li key={c.id} className={c.resolved ? "is-done" : ""}>
        <div className="cv-c-meta"><b translate="no">{c.author}</b><small>{ago(c.createdAt)}</small></div>
        {where && c.nodeId && <button type="button" className="cv-c-node" onClick={() => onFocusNode(c.nodeId!)} title="Go to this node">On {where}</button>}
        <p translate="no">{c.text}</p>
        <div className="cv-c-act">
          <button type="button" onClick={() => resolve(c.id, !c.resolved)}>{c.resolved ? "Reopen" : "Resolve"}</button>
          {c.mine && <button type="button" aria-label="Delete comment" onClick={() => remove(c.id)}><Trash2 size={13} /></button>}
        </div>
      </li>
    );
  };
  return (
    <div className="cv-pop" role="dialog" aria-label="Comments">
      <header><b>Comments</b><button type="button" aria-label="Close" onClick={onClose}><X size={16} /></button></header>
      <div className="cv-pop-body">
        {!enabled ? <p className="cv-none">Comments need an account. Sign in to leave notes for your team.</p> : (
          <>
            <section>
              <GrowCommentBox value={text} onChange={setText} onSend={() => void send()} />
              {selected && <label className="cv-c-pin"><input type="checkbox" checked={onNode} onChange={(e) => setOnNode(e.target.checked)} /> Pin to {selected.title}</label>}
              <button type="button" className="cv-go" disabled={!text.trim() || busy} onClick={() => void send()}>Comment</button>
              {error && <p className="cv-error" role="alert">{error}</p>}
            </section>
            <section>
              <h3>Open ({open.length})</h3>
              {open.length ? <ul className="cv-c-list">{open.map(row)}</ul> : <p className="cv-none">No open comments.</p>}
            </section>
            {done.length > 0 && (
              <section>
                <button type="button" className="cv-send-toggle" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}><MessageSquareText size={12} /> Resolved ({done.length})</button>
                {showDone && <ul className="cv-c-list">{done.map(row)}</ul>}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function GrowCommentBox({ value, onChange, onSend }: { value: string; onChange: (v: string) => void; onSend: () => void }) {
  return <textarea className="cv-input cv-c-box" rows={3} maxLength={1000} value={value} placeholder="Write a comment…" aria-label="Comment" onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSend(); } }} />;
}
