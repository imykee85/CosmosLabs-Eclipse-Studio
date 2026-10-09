"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import AgentIcon from "../AgentIcon";
import SoonTag from "../SoonTag";

const POS_KEY = "eclipse-agent-widget-pos";
const SIZE = 64;

// The agent as a little animated character: the Agents ball with two eyes. It floats, blinks, looks toward your finger or
// cursor, leans when you drag it and hops when you tap it. Drawn in the theme's text colour, eyes in the page colour.
function Bot() {
  return (
    <svg className="aw-bot" viewBox="0 0 48 48" width="64" height="64" aria-hidden="true">
      <circle cx="24" cy="24" r="20" fill="currentColor" />
      <g className="aw-eyes" transform="rotate(-27 24 22)">
        <rect className="aw-eye" x="14.2" y="14.5" width="4.4" height="10" rx="2.2" />
        <rect className="aw-eye" x="28.6" y="14.5" width="4.4" height="10" rx="2.2" />
      </g>
    </svg>
  );
}

// A floating agent button that appears while the agent switch is on. Drag it anywhere on the screen (it stays where you
// leave it, remembered in this browser); tap it to open a small card about the agent.
export default function AgentWidget({ name }: { name: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [hop, setHop] = useState(false);
  const [dragging, setDragging] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);

  const clamp = (x: number, y: number) => ({ x: Math.min(Math.max(0, x), window.innerWidth - SIZE), y: Math.min(Math.max(0, y), window.innerHeight - SIZE) });

  useEffect(() => {
    let p: { x: number; y: number } | null = null;
    try { const raw = JSON.parse(localStorage.getItem(POS_KEY) ?? "null"); if (raw && typeof raw.x === "number" && typeof raw.y === "number") p = raw; } catch {}
    setPos(clamp(p?.x ?? window.innerWidth - SIZE, p?.y ?? Math.round(window.innerHeight * 0.32)));
    const onResize = () => setPos((q) => (q ? clamp(q.x, q.y) : q));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // The eyes look toward the pointer (or the last touch) wherever it is on the screen.
  useEffect(() => {
    const look = (e: PointerEvent) => {
      const el = btn.current;
      if (!el) return;
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

  if (!pos) return null;

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
    setOpen(false);
    setPos(clamp(e.clientX - d.dx, e.clientY - d.dy));
  }
  function up() {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    if (d.moved) { try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch {} }
    else { setOpen((o) => !o); setHop(true); window.setTimeout(() => setHop(false), 650); }
  }

  // The card opens on the side of the button with more room.
  const cardLeft = Math.min(Math.max(8, pos.x + SIZE / 2 - 130), window.innerWidth - 268);
  const cardTop = pos.y > window.innerHeight / 2 ? pos.y - 8 : pos.y + SIZE + 8;
  return (
    <>
      {open && <div className="aw-scrim" onPointerDown={() => setOpen(false)} />}
      {open && (
        <div className="aw-card" role="dialog" aria-label={name} style={{ left: cardLeft, top: cardTop, transform: pos.y > window.innerHeight / 2 ? "translateY(-100%)" : undefined }}>
          <div className="aw-head"><AgentIcon size={16} /><b>{name}</b><SoonTag /><button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={15} /></button></div>
          <p>I&rsquo;ll look over your prompt before you generate, point out anything that could go wrong and suggest a better one. This is coming soon.</p>
        </div>
      )}
      <button ref={btn} type="button" className={`aw-btn ${dragging ? "is-drag" : ""} ${hop ? "is-hop" : ""}`} aria-label={`${name} agent. Drag to move, tap to talk.`} style={{ left: pos.x, top: pos.y }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; setDragging(false); }}>
        <Bot />
      </button>
    </>
  );
}
