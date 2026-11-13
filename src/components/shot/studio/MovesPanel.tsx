"use client";
// The manual camera controls (the move pickers and sliders), shown in ShotMap's Motion mode beside the keyframe timeline.
import { COMBINABLE, MOVE_GROUPS, PRESETS, type PresetId } from "@/lib/shot/setup";
import type { MovesState } from "@/lib/shot/moves";

const LENSES = [14, 24, 35, 50, 85, 135, 200];

function MoveSelect({ label, value, onChange, none, combinableOnly, exclude }: { label: string; value: PresetId | null; onChange: (v: PresetId | null) => void; none?: string; combinableOnly?: boolean; exclude?: PresetId | null }) {
  return (
    <label className="ss-mv">
      <span>{label}</span>
      <select value={value ?? ""} onChange={(e) => onChange((e.target.value || null) as PresetId | null)} aria-label={label}>
        {none && <option value="">{none}</option>}
        {MOVE_GROUPS.map((g) => {
          const opts = g.options.filter((o) => o.id !== exclude && (!combinableOnly || COMBINABLE.includes(o.id)));
          return opts.length ? <optgroup key={g.id} label={g.label}>{opts.map((o) => <option key={o.id} value={o.id}>{g.label} {o.label}</option>)}</optgroup> : null;
        })}
      </select>
    </label>
  );
}

function Slide({ label, min, max, step = 1, value, text, onChange }: { label: string; min: number; max: number; step?: number; value: number; text: string; onChange: (v: number) => void }) {
  return (
    <label className="ss-mv-slide">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
      <em>{text}</em>
    </label>
  );
}

export function MovesPanel({ m, onChange, lengthS, maxLengthS, onLength }: { m: MovesState; onChange: (patch: Partial<MovesState>) => void; lengthS: number; maxLengthS: number; onLength: (s: number) => void }) {
  const stackable = COMBINABLE.includes(m.preset);
  const hint = PRESETS.find((p) => p.id === m.preset)?.hint ?? "";
  return (
    <div className="ss-moves" role="group" aria-label="Camera moves">
      <div className="ss-moves-row">
        <MoveSelect label="Move" value={m.preset} onChange={(v) => v && onChange({ preset: v, ...(v && !COMBINABLE.includes(v) ? { preset2: null } : {}) })} />
        {stackable && <MoveSelect label="Then also" value={m.preset2} none="No second move" combinableOnly exclude={m.preset} onChange={(v) => onChange({ preset2: v })} />}
        {stackable && m.preset2 && (
          <label className="ss-mv">
            <span>Combine</span>
            <select value={m.combine} onChange={(e) => onChange({ combine: e.target.value as "together" | "then" })} aria-label="Combine">
              <option value="together">At the same time</option>
              <option value="then">One after the other</option>
            </select>
          </label>
        )}
      </div>
      <p className="ss-moves-hint">{hint}</p>
      <div className="ss-moves-sliders">
        {stackable && m.preset2 && m.combine === "then" && <Slide label="Switches at" min={10} max={90} value={Math.round(m.split * 100)} text={`${Math.round(m.split * 100)}%`} onChange={(v) => onChange({ split: v / 100 })} />}
        <Slide label="Rotate" min={0} max={359} value={m.rotate} text={`${m.rotate}°`} onChange={(v) => onChange({ rotate: v })} />
        <Slide label="Vertical" min={-30} max={80} value={m.vertical} text={`${m.vertical}°`} onChange={(v) => onChange({ vertical: v })} />
        <Slide label="Distance" min={1} max={20} step={0.1} value={m.distance} text={`${m.distance.toFixed(1)} m`} onChange={(v) => onChange({ distance: v })} />
        <Slide label="Speed" min={25} max={300} value={Math.round(m.speed * 100)} text={`${Math.round(m.speed * 100)}%`} onChange={(v) => onChange({ speed: v / 100 })} />
        <Slide label="Length" min={2} max={Math.max(2, maxLengthS)} value={Math.min(lengthS, maxLengthS)} text={`${lengthS} s`} onChange={onLength} />
        <Slide label="Handheld shake" min={0} max={100} value={Math.round(m.shake * 100)} text={`${Math.round(m.shake * 100)}%`} onChange={(v) => onChange({ shake: v / 100 })} />
        <label className="ss-mv-slide">
          <span>Lens</span>
          <select value={m.lensMm} onChange={(e) => onChange({ lensMm: Number(e.target.value) })} aria-label="Lens">{LENSES.map((l) => <option key={l} value={l}>{l} mm</option>)}</select>
        </label>
      </div>
    </div>
  );
}
