"use client";

import GrowArea from "@/components/GrowArea";
import { thumbOf, fallbackTo } from "@/lib/thumb-url";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, History, Loader2, Maximize2, Minimize2, Paperclip, Pencil, RotateCcw, SquarePen, Trash2, X } from "lucide-react";
import AgentIcon from "../AgentIcon";
import { canUseFrame, useAgentChat, type Attach } from "@/lib/agent-chat";
import { uploadPicture, uploadVideo } from "@/lib/use-uploads";
import { readCurrentProject } from "@/lib/projects";
import { CUE_EVENT, takeCue } from "@/lib/use-agent";

const SIZE = 64;

// Where Atlas may stand (owner 2026-10-21): never up in the header, never below a prompt box, and beside the open sidebar (it moves with it).
const BOXES = ".cr-dock, .cr-box, .vc-console-wrap, .cn-dock, .cn-box, .pm-box, .tr-composer";
const seen = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r : null; };
const headerBottom = () => { for (const el of Array.from(document.querySelectorAll(".mb-top, .ws-topbar"))) { const r = seen(el); if (r) return Math.max(0, r.bottom); } return 0; };
// The sidebar (desktop) or the menu drawer (phone), when open: Atlas stands just right of its edge.
const sidebarEdge = () => {
  let edge = 0;
  for (const el of Array.from(document.querySelectorAll(".ws-sidebar, .mb-panel"))) {
    const r = seen(el);
    if (r && r.right > 0 && r.left <= 1) edge = Math.max(edge, r.right);
  }
  return Math.min(edge, Math.max(0, window.innerWidth - SIZE));
};
const boxTop = (above: number) => {
  let top = window.innerHeight;
  for (const el of Array.from(document.querySelectorAll(BOXES))) { const r = seen(el); if (r && r.top > above + SIZE && r.top < top) top = r.top; }
  return top;
};
const limits = () => { const minY = headerBottom(); return { minY, maxY: Math.max(minY, Math.min(window.innerHeight, boxTop(minY)) - SIZE - 6) }; };

// A picture or clip added in the chat, shown as what it is (not an icon): the picture's small copy, or the clip's first frame.
function Thumb({ kind, id, name, big = false }: { kind: "picture" | "video"; id: string; name: string; big?: boolean }) {
  const cls = big ? "aw-thumb is-big" : "aw-thumb";
  if (kind === "video") return <video className={cls} src={`/api/generations/${id}/file#t=0.1`} muted playsInline preload="metadata" aria-label={name} />;
  const full = `/api/uploads/${id}/file`;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={cls} src={thumbOf("upload", id)} alt={name} onError={fallbackTo(full)} draggable={false} />;
}

// The agent as a little 3D character: a ball that always stays round, with two eyes that sit on its surface and travel round it. It floats, blinks, turns its head toward your
// finger or cursor, and spins all the way round when you tap it. Real CSS 3D (no images), drawn in the theme's colours.
function Bot() {
  return (
    <div className="aw-3d" aria-hidden="true">
      <div className="aw-float">
        <div className="aw-ball" />
        <div className="aw-spin">
          <div className="aw-sphere">
            <i className="aw-eye aw-eye-l"><b /></i>
            <i className="aw-eye aw-eye-r"><b /></i>
          </div>
        </div>
      </div>
      <div className="aw-ground" />
    </div>
  );
}

// A floating agent button that appears while the agent switch is on. Drag it anywhere on the screen (it stays where you
// leave it, remembered in this browser); tap it to open a small card about the agent.
export default function AgentWidget({ name, watch }: { name: string; watch?: string | null }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [hop, setHop] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [bounce, setBounce] = useState(false);
  const [big, setBig] = useState(false);
  const [showPast, setShowPast] = useState(false);
  // Pictures and videos added in the chat itself (paperclip): uploaded at once, sent with the next message.
  const [atts, setAtts] = useState<Attach[]>([]);
  const [uploading, setUploading] = useState<number | null>(null);
  const [attErr, setAttErr] = useState("");
  const fileIn = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const chat = useAgentChat(name);
  // The latest real answer (not a status note) gets the Try again button.
  const lastAgent = chat.messages.reduce((n, m, i) => (m.role === "agent" && !m.note ? i : n), -1);
  const list = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);

  const baseX = useRef(0); // the sidebar's edge the position was last measured against
  const clamp = (x: number, y: number) => { const { minY, maxY } = limits(); return { x: Math.min(Math.max(0, x), Math.max(0, window.innerWidth - SIZE)), y: Math.min(Math.max(minY, y), maxY) }; };

  useEffect(() => {
    // Every time the agent is switched on it stands in the same default spot (owner 2026-10-21): right under the menu icon at the top left, and beside the sidebar
    // when that is open. When the sidebar opens or closes Atlas moves with it. Dragging moves it for this visit only; nothing is remembered.
    baseX.current = sidebarEdge();
    setPos(clamp(baseX.current, headerBottom()));
    const sync = () => setPos((q) => {
      if (!q) return q;
      const edge = sidebarEdge();
      const dx = edge - baseX.current;
      baseX.current = edge;
      const n = clamp(q.x + dx, q.y);
      return n.x === q.x && n.y === q.y ? q : n;
    });
    let frames = 0;
    const burst = () => { frames = Math.max(frames, 40); if (frames === 40) tick(); };
    const tick = () => { sync(); if (--frames > 0) requestAnimationFrame(tick); };
    const slow = window.setInterval(sync, 700);
    const root = document.querySelector(".ws-root");
    const watch = root ? new MutationObserver(burst) : null;
    watch?.observe(root!, { attributes: true, attributeFilter: ["class"], subtree: true });
    window.addEventListener("resize", burst);
    window.visualViewport?.addEventListener("resize", burst);
    document.addEventListener("transitionrun", burst, true);
    document.addEventListener("click", burst, true);
    return () => {
      window.clearInterval(slow); watch?.disconnect();
      window.removeEventListener("resize", burst); window.visualViewport?.removeEventListener("resize", burst);
      document.removeEventListener("transitionrun", burst, true); document.removeEventListener("click", burst, true);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The eyes look toward the pointer (or the last touch) wherever it is on the screen.
  const watching = useRef<string | null>(null);
  watching.current = watch ?? null;
  useEffect(() => {
    const look = (e: PointerEvent) => {
      const el = btn.current;
      if (!el || watching.current) return;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 160);
      el.style.setProperty("--lx", String((dx / d) * k));
      el.style.setProperty("--ly", String((dy / d) * k));
    };
    window.addEventListener("pointermove", look);
    window.addEventListener("pointerdown", look);
    return () => { window.removeEventListener("pointermove", look); window.removeEventListener("pointerdown", look); };
  }, []);

  // While something is being made, the agent keeps its eyes on the preview (the element named by `watch`).
  useEffect(() => {
    if (!watch) return;
    const tick = () => {
      const el = btn.current;
      const target = document.querySelector(watch);
      if (!el || !target) return;
      const r = el.getBoundingClientRect(), t = target.getBoundingClientRect();
      const dx = t.left + t.width / 2 - (r.left + r.width / 2), dy = t.top + t.height / 2 - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 120);
      el.style.setProperty("--lx", String((dx / d) * k));
      el.style.setProperty("--ly", String((dy / d) * k));
    };
    tick();
    const id = window.setInterval(tick, 120);
    return () => window.clearInterval(id);
  }, [watch]);

  // Switched on: spin and open with an introduction. Switched to another agent: a little bounce and that agent's introduction.
  const [cue, setCue] = useState(() => takeCue());
  useEffect(() => {
    const on = () => { const c = takeCue(); if (c) setCue(c); };
    window.addEventListener(CUE_EVENT, on);
    return () => window.removeEventListener(CUE_EVENT, on);
  }, []);
  useEffect(() => {
    if (!cue || cue.agent !== name || !pos) return;
    setCue(null);
    if (cue.kind === "on") { setHop(true); window.setTimeout(() => setHop(false), 1000); }
    else { setBounce(true); window.setTimeout(() => setBounce(false), 700); }
  }, [cue, name, pos]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const o = () => setOpen(true); window.addEventListener("eclipse-agent-open", o); return () => window.removeEventListener("eclipse-agent-open", o); }, []);
  useEffect(() => { const el = list.current; if (el) el.scrollTop = el.scrollHeight; }, [chat.messages.length, chat.busy, open, big]);
  useEffect(() => { if (!open) { setBig(false); setShowPast(false); } }, [open]);

  if (!pos) return null;

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const t = draft.trim();
    if (!t || chat.busy || uploading !== null) return;
    setDraft("");
    const sent = atts;
    setAtts([]);
    setAttErr("");
    void chat.send(t, sent);
  }

  async function addFiles(files: FileList | null) {
    const list = Array.from(files ?? []).slice(0, 4);
    if (fileIn.current) fileIn.current.value = "";
    if (!list.length) return;
    setAttErr("");
    const projectId = readCurrentProject()?.id ?? null;
    for (const f of list) {
      const name = f.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Attachment";
      const isVideo = f.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(f.name);
      setUploading(0);
      if (isVideo) {
        const r = await uploadVideo<{ id: string }>(f, name, projectId, setUploading);
        if (r.ok && r.item?.id) setAtts((a) => [...a, { kind: "video" as const, id: r.item.id, name }].slice(-4));
        else setAttErr(r.ok ? "Could not add that video." : r.error);
      } else {
        const r = await uploadPicture(f, "asset", name, projectId, setUploading);
        if (r.ok && r.item?.id) setAtts((a) => [...a, { kind: "picture" as const, id: r.item!.id, name }].slice(-4));
        else setAttErr(r.ok ? "Could not add that picture." : r.error);
      }
    }
    setUploading(null);
  }

  function down(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - pos!.x, dy: e.clientY - pos!.y, sx: e.clientX, sy: e.clientY, moved: false };
  }
  function move(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return;
    d.moved = true;
    setDragging(true);
    setPos(clamp(e.clientX - d.dx, e.clientY - d.dy));
  }
  function up() {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    else setOpen(true); // tapping opens the card; the spin is for switching the agent on (see the cue effect)
  }

  // The card always opens below the agent.
  const cardLeft = Math.min(Math.max(8, pos.x + SIZE / 2 - 130), window.innerWidth - 268);
  const cardTop = pos.y + SIZE + 8;
  return (
    <>
      {open && (
        <div className={`aw-card ${big ? "is-big" : ""}`} role="dialog" aria-label={`${name} chat`} style={big ? undefined : { left: cardLeft, top: cardTop }}>
          <div className="aw-head"><AgentIcon size={16} /><b>{name}</b>
            <button type="button" aria-label="Chat history" title="Chat history" className={showPast ? "is-on" : ""} onClick={() => setShowPast((v) => !v)}><History size={15} /></button>
            <button type="button" aria-label="New chat" title="New chat" disabled={chat.busy} onClick={() => { chat.newChat(); setShowPast(false); }}><SquarePen size={14} /></button>
            <button type="button" aria-label={big ? "Make smaller" : "Expand"} title={big ? "Make smaller" : "Expand"} onClick={() => setBig((b) => !b)}>{big ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={15} /></button></div>
          {showPast ? (
            <div className="aw-msgs aw-past">
              {chat.past.length === 0 && <p className="aw-empty">No earlier chats yet. Press New chat to keep this one and start another.</p>}
              {chat.past.map((c) => (
                <div key={c.id} className="aw-past-row">
                  <button type="button" onClick={() => { chat.openPast(c.id); setShowPast(false); }}><b>{c.title}</b><span>{new Date(c.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · {c.messages.length} messages</span></button>
                  <button type="button" className="aw-past-del" aria-label="Delete this chat" title="Delete this chat" onClick={() => chat.deletePast(c.id)}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          ) : (
          <div className="aw-msgs" ref={list} aria-live="polite">
            {chat.messages.length === 0 && <p className="aw-empty">Say hello, or tell me what you want to make.</p>}
            {chat.messages.map((m, at) => (
              <div key={m.id} className={`aw-msg is-${m.role} ${m.error ? "is-error" : ""} ${m.note ? "is-note" : ""} ${editing?.id === m.id ? "is-editing" : ""}`}>
                {m.attach && m.attach.length > 0 && <div className="aw-attached">{m.attach.map((a, i) => (a.id ? <Thumb key={a.id + i} kind={a.kind} id={a.id} name={a.name} big /> : <span key={a.name + i} className="aw-att-name">{a.name}</span>))}</div>}
                {editing?.id === m.id ? (
                  <form className="aw-edit" onSubmit={(e) => { e.preventDefault(); const t = editing.text; setEditing(null); void chat.resend(m.id, t); }}>
                    <GrowArea rows={2} value={editing.text} maxLength={4000} aria-label="Edit your message" autoFocus onChange={(e) => setEditing({ id: m.id, text: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); const t = editing.text; setEditing(null); void chat.resend(m.id, t); } }} />
                    <div className="aw-edit-acts">
                      <button type="button" onClick={() => setEditing(null)}>Cancel</button>
                      <button type="submit" className="is-send" disabled={!editing.text.trim()}>Send</button>
                    </div>
                  </form>
                ) : m.text && <p>{m.text}</p>}
                {m.frames && m.frames.length > 0 && (
                  <div className="aw-frames">
                    {m.frames.map((f) => (
                      <figure key={f.id} className="aw-frame">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/uploads/${f.id}/file`} alt={f.label} loading="lazy" />
                        <figcaption>{f.sec.toFixed(1)} s · saved to Assets</figcaption>
                        {canUseFrame() && (
                          <div className="aw-frame-acts">
                            <button type="button" disabled={!!f.used || chat.busy} onClick={() => void chat.useFrame(m.id, f.id, "start")}>{f.used === "start" ? "Start frame \u2713" : "Use as start frame"}</button>
                            <button type="button" disabled={!!f.used || chat.busy} onClick={() => void chat.useFrame(m.id, f.id, "ingredient")}>{f.used === "ingredient" ? "Ingredient \u2713" : "Use as ingredient"}</button>
                          </div>
                        )}
                      </figure>
                    ))}
                  </div>
                )}
                {m.actions && m.actions.length > 0 && (
                  <div className="aw-acts">
                    {m.actions.map((a) => (
                      <button key={a.id} type="button" className={`aw-act is-${a.kind} ${a.used ? "is-used" : ""}`} disabled={a.used || chat.busy} onClick={() => void chat.run(m.id, a.id)}>{a.used ? `${a.label} \u2713` : a.label}</button>
                    ))}
                    {m.actions.some((a) => a.prompt) && <blockquote className="aw-prompt">{m.actions.find((a) => a.prompt)?.prompt}</blockquote>}
                  </div>
                )}
                {!chat.busy && !editing && !m.note && (m.role === "user"
                  ? <div className="aw-msg-acts"><button type="button" aria-label="Edit and resend" title="Edit and resend" onClick={() => setEditing({ id: m.id, text: m.text })}><Pencil size={13} /></button></div>
                  : (m.error || at === lastAgent) && <div className="aw-msg-acts"><button type="button" aria-label="Try again" title="Try again" onClick={() => void chat.retry(m.id)}><RotateCcw size={13} /></button></div>)}
              </div>
            ))}
            {chat.busy && <div className="aw-msg is-agent"><p className="aw-typing"><Loader2 size={13} className="cr-spin" /> Thinking…</p></div>}
          </div>
          )}
          {(atts.length > 0 || uploading !== null || attErr) && (
            <div className="aw-atts">
              {atts.map((a) => (
                <span key={a.id} className="aw-att aw-att-pic" title={a.name}><Thumb kind={a.kind} id={a.id} name={a.name} /><button type="button" aria-label={`Remove ${a.name}`} onClick={() => setAtts((l) => l.filter((x) => x.id !== a.id))}><X size={11} /></button></span>
              ))}
              {uploading !== null && <span className="aw-att"><Loader2 size={12} className="cr-spin" />{uploading > 0 && uploading < 1 ? `${Math.round(uploading * 100)}%` : "Adding…"}</span>}
              {attErr && <span className="aw-att is-error">{attErr}</span>}
            </div>
          )}
          <form className="aw-input" onSubmit={submit}>
            <input ref={fileIn} type="file" hidden multiple accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm,.mov,.mp4,.webm,.m4v" onChange={(e) => void addFiles(e.target.files)} />
            <button type="button" className="aw-clip" aria-label="Add a picture or video" title="Add a picture or video" disabled={uploading !== null || chat.busy || atts.length >= 4} onClick={() => fileIn.current?.click()}><Paperclip size={15} /></button>
            <GrowArea noExpand value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Message ${name}…`} aria-label={`Message ${name}`} maxLength={2000} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }} />
            <button type="submit" aria-label="Send" disabled={!draft.trim() || chat.busy || uploading !== null}><ArrowUp size={16} /></button>
          </form>
        </div>
      )}
      <button ref={btn} type="button" className={`aw-btn ${dragging ? "is-drag" : ""} ${hop ? "is-hop" : ""} ${bounce ? "is-bounce" : ""}`} aria-label={`${name} agent. Drag to move, tap to talk.`} style={{ left: pos.x, top: pos.y }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; setDragging(false); }}>
        <Bot />
      </button>
    </>
  );
}
