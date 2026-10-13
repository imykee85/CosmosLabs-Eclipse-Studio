"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

// The pictures and clips chosen for a video, shown in the order the person likes (a video first, a picture first: their choice) and re-orderable by
// dragging: a mouse drags at once, a finger holds for a moment first so a normal swipe still scrolls. Alt + the arrow keys does the same from the keyboard.
// The order is only the person's layout: what each item IS for is carried by its tag and sent to the server by role, never by position.
export type RefItem = { key: string; kind: "pic" | "vid"; src: string; tag: string; label: string; title: string; onRemove: () => void };

const HOLD_MS = 220;

export default function OrderedRefs({ items, onReorder }: { items: RefItem[]; onReorder: (keys: string[]) => void }) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const drag = useRef<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const live = useRef({ items, onReorder }); live.current = { items, onReorder };
  const press = useRef<{ key: string; x: number; y: number; timer: number | null; touch: boolean } | null>(null);

  const begin = (key: string) => { drag.current = key; setDragKey(key); try { navigator.vibrate?.(8); } catch {} };
  const end = () => { if (press.current?.timer) window.clearTimeout(press.current.timer); press.current = null; drag.current = null; setDragKey(null); };

  function moveTo(key: string, to: number) {
    const keys = live.current.items.map((i) => i.key);
    const from = keys.indexOf(key);
    if (from < 0 || to < 0 || to >= keys.length || from === to) return;
    keys.splice(to, 0, keys.splice(from, 1)[0]);
    live.current.onReorder(keys);
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const p = press.current;
      if (!p) return;
      if (!drag.current) {
        const far = Math.hypot(e.clientX - p.x, e.clientY - p.y);
        if (p.touch) { if (far > 8) end(); } else if (far > 4) begin(p.key);
        return;
      }
      const kids = Array.from(wrap.current?.children ?? []) as HTMLElement[];
      const over = kids.findIndex((k) => { const r = k.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top - 8 && e.clientY <= r.bottom + 8; });
      if (over >= 0) moveTo(drag.current, over);
    }
    // A finger that is dragging must not also scroll the page.
    function onTouchMove(e: TouchEvent) { if (drag.current && e.cancelable) e.preventDefault(); }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end); window.removeEventListener("touchmove", onTouchMove); };
  }, []);

  function down(e: React.PointerEvent, key: string) {
    if ((e.target as HTMLElement).closest("button") || (e.pointerType === "mouse" && e.button !== 0)) return;
    const touch = e.pointerType !== "mouse";
    press.current = { key, x: e.clientX, y: e.clientY, touch, timer: touch ? window.setTimeout(() => begin(key), HOLD_MS) : null };
  }

  function keys(e: React.KeyboardEvent, key: string, i: number) {
    if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault();
    moveTo(key, i + (e.key === "ArrowLeft" ? -1 : 1));
    requestAnimationFrame(() => (wrap.current?.children[Math.max(0, Math.min(items.length - 1, i + (e.key === "ArrowLeft" ? -1 : 1)))] as HTMLElement | undefined)?.focus());
  }

  return (
    <div className="cr-refs vs-ordered" ref={wrap} aria-label="Pictures and clips for this video. Hold and drag, or press Alt and an arrow key, to change their order.">
      {items.map((it, i) => (
        <span key={it.key} className={`cr-ref vs-ref ${dragKey === it.key ? "is-drag" : ""}`} tabIndex={0} title={it.title} onPointerDown={(e) => down(e, it.key)} onKeyDown={(e) => keys(e, it.key, i)}>
          {it.kind === "pic"
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={it.src} alt={it.label} draggable={false} />
            : <video src={it.src} muted playsInline preload="metadata" />}
          <i className="cr-ref-n vs-tag">{it.tag}</i>
          <button type="button" className="cr-ref-x" aria-label={`Remove ${it.label}`} onClick={it.onRemove}><X size={12} /></button>
        </span>
      ))}
    </div>
  );
}
