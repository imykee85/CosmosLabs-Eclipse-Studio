"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Maximize2, Minimize2, Trash2, X } from "lucide-react";
import AgentIcon from "../AgentIcon";
import { useAgentChat } from "@/lib/agent-chat";
import { CUE_EVENT, takeCue } from "@/lib/use-agent";

const POS_KEY = "eclipse-agent-widget-pos";
const SIZE = 64;

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
  const [draft, setDraft] = useState("");
  const chat = useAgentChat(name);
  const list = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);

  const clamp = (x: number, y: number) => ({ x: Math.min(Math.max(0, x), window.innerWidth - SIZE), y: Math.min(Math.max(0, y), window.innerHeight - SIZE) });

  useEffect(() => {
    let p: { x: number; y: number } | null = null;
    try { const raw = JSON.parse(localStorage.getItem(POS_KEY) ?? "null"); if (raw && typeof raw.x === "number" && typeof raw.y === "number") p = raw; } catch {}
    // Default stance: parked on the left edge, just above the prompt box, facing in toward the screen.
    setPos(clamp(p?.x ?? 0, p?.y ?? Math.round(window.innerHeight * 0.555)));
    const onResize = () => setPos((q) => (q ? clamp(q.x, q.y) : q));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
    setOpen(true);
    if (cue.kind === "on") { setHop(true); window.setTimeout(() => setHop(false), 1000); }
    else { setBounce(true); window.setTimeout(() => setBounce(false), 700); }
    chat.introduce();
  }, [cue, name, pos]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const o = () => setOpen(true); window.addEventListener("eclipse-agent-open", o); return () => window.removeEventListener("eclipse-agent-open", o); }, []);
  useEffect(() => { const el = list.current; if (el) el.scrollTop = el.scrollHeight; }, [chat.messages.length, chat.busy, open, big]);
  useEffect(() => { if (!open) setBig(false); }, [open]);

  if (!pos) return null;

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const t = draft.trim();
    if (!t || chat.busy) return;
    setDraft("");
    void chat.send(t);
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
    if (d.moved) { try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch {} }
    else { setOpen(true); setHop(true); window.setTimeout(() => setHop(false), 1000); }
  }

  // The card opens on the side of the button with more room.
  const cardLeft = Math.min(Math.max(8, pos.x + SIZE / 2 - 130), window.innerWidth - 268);
  const cardTop = pos.y > window.innerHeight / 2 ? pos.y - 8 : pos.y + SIZE + 8;
  return (
    <>
      {open && (
        <div className={`aw-card ${big ? "is-big" : ""}`} role="dialog" aria-label={`${name} chat`} style={big ? undefined : { left: cardLeft, top: cardTop, transform: pos.y > window.innerHeight / 2 ? "translateY(-100%)" : undefined }}>
          <div className="aw-head"><AgentIcon size={16} /><b>{name}</b>
            {chat.messages.length > 0 && <button type="button" aria-label="Clear the chat" title="Clear the chat" onClick={chat.clear}><Trash2 size={14} /></button>}
            <button type="button" aria-label={big ? "Make smaller" : "Expand"} title={big ? "Make smaller" : "Expand"} onClick={() => setBig((b) => !b)}>{big ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={15} /></button></div>
          <div className="aw-msgs" ref={list} aria-live="polite">
            {chat.messages.length === 0 && <p className="aw-empty">Say hello, or tell me what you want to make.</p>}
            {chat.messages.map((m) => (
              <div key={m.id} className={`aw-msg is-${m.role} ${m.error ? "is-error" : ""} ${m.note ? "is-note" : ""}`}>
                {m.text && <p>{m.text}</p>}
                {m.actions && m.actions.length > 0 && (
                  <div className="aw-acts">
                    {m.actions.map((a) => (
                      <button key={a.id} type="button" className={`aw-act is-${a.kind} ${a.used ? "is-used" : ""}`} disabled={a.used || chat.busy} onClick={() => void chat.run(m.id, a.id)}>{a.used ? `${a.label} \u2713` : a.label}</button>
                    ))}
                    {m.actions.some((a) => a.prompt) && <blockquote className="aw-prompt">{m.actions.find((a) => a.prompt)?.prompt}</blockquote>}
                  </div>
                )}
              </div>
            ))}
            {chat.busy && <div className="aw-msg is-agent"><p className="aw-typing"><Loader2 size={13} className="cr-spin" /> Thinking…</p></div>}
          </div>
          <form className="aw-input" onSubmit={submit}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Message ${name}…`} aria-label={`Message ${name}`} maxLength={2000} />
            <button type="submit" aria-label="Send" disabled={!draft.trim() || chat.busy}><ArrowUp size={16} /></button>
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
