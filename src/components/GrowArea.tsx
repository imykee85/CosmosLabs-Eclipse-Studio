"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import type { ChangeEvent, TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { Check, Maximize2, Minimize2 } from "lucide-react";
import "./grow-area.css";

// The one text box behaviour for every prompt box in the app (owner 2026-10-19): it starts at `rows` lines, grows line by line up to
// `maxLines` (3), and once the text needs more than that an expand icon appears at its top right and opens a full-screen editor,
// so text never runs on in one endless hidden line. Enter always makes a new line; sending is the button (or Ctrl/Cmd + Enter,
// where a screen offers it). Drop-in replacement for <textarea>.
type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows"> & { rows?: number; maxLines?: number; wrapClassName?: string; editorLabel?: string };

const GrowArea = forwardRef<HTMLTextAreaElement, Props>(function GrowArea({ rows = 1, maxLines = 3, wrapClassName = "", editorLabel = "Write your text", onChange, ...rest }, fwd) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(fwd, () => ref.current as HTMLTextAreaElement);
  const [over, setOver] = useState(false);
  const [open, setOpen] = useState(false);
  const value = String(rest.value ?? "");

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize) || 16;
    const lh = parseFloat(cs.lineHeight) || fs * 1.4;
    const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const border = cs.boxSizing === "border-box" ? (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0) : 0;
    const min = Math.round(lh * rows + pad + border);
    const max = Math.round(lh * maxLines + pad + border);
    el.style.minHeight = `${min}px`;
    el.style.maxHeight = `${max}px`;
    el.style.height = "0px"; // measure the real content height
    const need = el.scrollHeight + border;
    el.style.height = `${Math.min(Math.max(need, min), max)}px`;
    const spill = need > max + 1;
    el.style.overflowY = spill ? "auto" : "hidden";
    setOver(spill);
  }, [rows, maxLines]);

  useLayoutEffect(fit, [fit, value]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => fit()) : null;
    ro?.observe(el);
    // Phones briefly enlarge the text while a box has focus (so iOS does not zoom): measure again then and after it settles.
    let t = 0;
    const again = () => { fit(); window.clearTimeout(t); t = window.setTimeout(fit, 760); };
    el.addEventListener("focus", again);
    window.addEventListener("resize", fit);
    return () => { ro?.disconnect(); el.removeEventListener("focus", again); window.removeEventListener("resize", fit); window.clearTimeout(t); };
  }, [fit]);

  return (
    <div className={`pe-wrap ${wrapClassName}`}>
      <textarea {...rest} ref={ref} rows={rows} onChange={onChange} />
      {over && !open && (
        <button type="button" className="pe-expand" aria-label="Expand the text box" title="Expand" onClick={() => setOpen(true)}><Maximize2 size={15} /></button>
      )}
      {open && <Editor label={editorLabel} value={value} maxLength={rest.maxLength} placeholder={rest.placeholder} onChange={onChange} onClose={() => { setOpen(false); window.setTimeout(() => ref.current?.focus(), 0); }} />}
    </div>
  );
});

export default GrowArea;

function Editor({ label, value, maxLength, placeholder, onChange, onClose }: { label: string; value: string; maxLength?: number; placeholder?: string; onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void; onClose: () => void }) {
  // Keep the editor (and its Done button) above the on-screen keyboard.
  const [vvh, setVvh] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const f = () => setVvh(vv.height);
    f();
    vv.addEventListener("resize", f);
    return () => vv.removeEventListener("resize", f);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="a-theme">
      <div className="pe-full" style={vvh ? { height: vvh, bottom: "auto" } : undefined} role="dialog" aria-label={label}>
        <button type="button" className="pe-full-x" aria-label="Back to the text box" title="Back" onClick={onClose}><Minimize2 size={16} /></button>
        <textarea autoFocus aria-label={label} value={value} maxLength={maxLength} placeholder={placeholder} onChange={onChange} onFocus={(e) => e.currentTarget.setSelectionRange(value.length, value.length)} />
        <button type="button" className="pe-done" aria-label="Done" title="Done" onClick={onClose}><Check size={20} /></button>
      </div>
    </div>,
    document.body,
  );
}
