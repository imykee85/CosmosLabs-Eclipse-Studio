"use client";

import { useEffect } from "react";
import { Clapperboard, Sprout } from "lucide-react";

// The pop-up behind the settings icon at the far end of the chip row (reached by swiping the row left): the settings only some video models have.
// Anything the chosen model cannot use is greyed out with a line saying so, never hidden.
export default function VideoSettingsMenu({ anchor, label, seed, seedLocked, onSeedLocked, seedText, onSeedText, seedBad, negMax, negative, onNegative, cfg, creative, onCreative, multiShot = false, shotsOn = false, onShots, onClose }: {
  anchor: DOMRect; label: string;
  seed: { min: number; max: number } | null; seedLocked: boolean; onSeedLocked: (v: boolean) => void; seedText: string; onSeedText: (v: string) => void; seedBad: boolean;
  negMax: number | null; negative: string; onNegative: (v: string) => void;
  cfg: boolean; creative: number | null; onCreative: (v: number) => void;
  multiShot?: boolean; shotsOn?: boolean; onShots?: (on: boolean) => void; // several shots in one clip (Kling 3.0); the shots are written under the prompt box
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const width = Math.min(320, window.innerWidth - 16);
  const left = Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8));
  return (
    <>
      <div className="am-scrim" onMouseDown={onClose} onTouchStart={onClose} />
      <div className="am-menu vm-menu" role="dialog" aria-label="Settings" style={{ left, width, bottom: window.innerHeight - anchor.top + 8 }}>
        <section className={seed ? "" : "is-off"}>
          <div className="vm-head">
            <b><Sprout size={14} /> Fixed seed</b>
            <button type="button" role="switch" aria-checked={seedLocked && !!seed} disabled={!seed} aria-label="Fixed seed" className={`cr-switch ${seedLocked && seed ? "is-on" : ""}`} onClick={() => onSeedLocked(!seedLocked)}><i /></button>
          </div>
          {seed && seedLocked ? (
            <input inputMode="numeric" aria-label="Seed number" aria-invalid={seedBad} placeholder="random" value={seedText} onChange={(e) => onSeedText(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))} />
          ) : null}
          <small>{seed ? "Fix the seed to get a similar result again." : `${label} has no seed.`}</small>
        </section>
        <section className={negMax != null ? "" : "is-off"}>
          <div className="vm-head"><b>Leave out</b></div>
          <textarea rows={2} disabled={negMax == null} maxLength={negMax ?? undefined} placeholder="What the video should not show…" aria-label="Leave out" value={negative} onChange={(e) => onNegative(e.target.value)} />
          {negMax == null && <small>{label} has no negative prompt.</small>}
        </section>
        <section className={multiShot ? "" : "is-off"}>
          <div className="vm-head">
            <b><Clapperboard size={14} /> Multi-shot</b>
            <button type="button" role="switch" aria-checked={shotsOn && multiShot} disabled={!multiShot} aria-label="Multi-shot" className={`cr-switch ${shotsOn && multiShot ? "is-on" : ""}`} onClick={() => onShots?.(!shotsOn)}><i /></button>
          </div>
          <small>{multiShot ? "Up to 6 shots in one clip, each with its own description and length." : `${label} has no multi-shot mode.`}</small>
        </section>
        <section className={cfg ? "" : "is-off"}>
          <div className="vm-head"><b>Prompt strength</b><em>{cfg ? (creative == null ? "default" : creative.toFixed(2)) : ""}</em></div>
          <input type="range" min={0} max={1} step={0.05} disabled={!cfg} value={creative ?? 0.5} onChange={(e) => onCreative(Number(e.target.value))} aria-label="Prompt strength" />
          {!cfg && <small>{label} has no prompt strength setting.</small>}
        </section>
      </div>
    </>
  );
}
