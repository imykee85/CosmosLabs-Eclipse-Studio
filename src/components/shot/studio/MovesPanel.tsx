"use client";
// The manual camera controls in ShotMap's Motion mode, as in the original ShotMap panel: move pickers (a first and a second move), then the sliders.
// The camera then runs the move itself (see lib/shot/moves.ts); there are no keyframes to manage.
import { COMBINABLE, type PresetId } from "@/lib/shot/setup";
import type { MovesState } from "@/lib/shot/moves";
import Bar from "../../create/Bar";
import { MovePicker } from "../ShotMapPanel";
import "../shot.css";

export function MovesPanel({ m, onChange, lengthS, maxLengthS, onLength }: { m: MovesState; onChange: (patch: Partial<MovesState>) => void; lengthS: number; maxLengthS: number; onLength: (s: number) => void }) {
  const stackable = COMBINABLE.includes(m.preset);
  return (
    <div className="ss-moves cr-light" role="group" aria-label="Camera moves">
      <div className="cr-light-label">Camera move</div>
      <MovePicker label="Camera move" value={m.preset === "static" ? null : m.preset} onChange={(id) => { if (!id) { onChange({ preset: "static" as PresetId, preset2: null }); return; } onChange({ preset: id, ...(COMBINABLE.includes(id) ? {} : { preset2: null }) }); }} />
      {stackable && (
        <>
          <div className="cr-light-label">Add a second move</div>
          <MovePicker label="Second move" value={m.preset2} none exclude={m.preset} combinableOnly onChange={(id) => onChange({ preset2: id })} />
          {m.preset2 && (
            <>
              <div className="cr-light-quick is-three sm-moves" role="group" aria-label="How the moves combine">
                <button type="button" className={m.combine === "together" ? "is-on" : ""} onClick={() => onChange({ combine: "together" })}>At the same time</button>
                <button type="button" className={m.combine === "then" ? "is-on" : ""} onClick={() => onChange({ combine: "then" })}>One after the other</button>
              </div>
              {m.combine === "then" && <Bar id="sm-split" label="Switches at" min={10} max={90} value={Math.round(m.split * 100)} unit="%" onChange={(v) => onChange({ split: v / 100 })} />}
            </>
          )}
        </>
      )}
      <Bar id="sm-rot" label="Rotate" min={0} max={359} value={Math.round(m.rotate)} unit="°" onChange={(v) => onChange({ rotate: v })} />
      <Bar id="sm-vert" label="Vertical" min={-30} max={80} value={Math.round(m.vertical)} unit="°" onChange={(v) => onChange({ vertical: v })} />
      <Bar id="sm-d" label="Distance" min={1} max={20} step={0.1} value={m.distance} text={`${m.distance.toFixed(1)} m`} onChange={(v) => onChange({ distance: v })} />
      <Bar id="sm-speed" label="Speed" min={25} max={300} value={Math.round(m.speed * 100)} unit="%" onChange={(v) => onChange({ speed: v / 100 })} />
      <Bar id="sm-lens" label="Lens" min={12} max={120} value={m.lensMm} unit="mm" onChange={(v) => onChange({ lensMm: v })} />
      <Bar id="sm-t" label="Length" min={2} max={Math.max(2, maxLengthS)} value={Math.min(lengthS, maxLengthS)} unit="s" onChange={onLength} />
      <Bar id="sm-s" label="Handheld shake" min={0} max={100} value={Math.round(m.shake * 100)} unit="%" onChange={(v) => onChange({ shake: v / 100 })} />
    </div>
  );
}
