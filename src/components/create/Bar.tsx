"use client";

/** A slider drawn as a filled bar with its name on the left and its value on the right. Shared by Relight and Change Camera. */
export default function Bar({ id, label, min, max, value, text, unit = "", step = 1, onChange }: { id: string; label: string; min: number; max: number; value: number; text?: string; unit?: string; step?: number; onChange: (v: number) => void }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="cr-bar">
      <div className="cr-bar-fill" style={{ width: `${pct}%` }} />
      <span className="cr-bar-line" style={{ left: `${pct}%` }} />
      <label htmlFor={id}>{label}</label>
      <output>{text ?? `${value}${unit && ` ${unit}`}`}</output>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
    </div>
  );
}
