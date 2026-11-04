"use client";

import { useEffect, useMemo, useState } from "react";
import { Grid3x3, Maximize2, X } from "lucide-react";
import GrowArea from "@/components/GrowArea";
import GenerateButton from "@/components/GenerateButton";
import { ETHNICITIES, FEATURE_NAME, GENDERS, GRIDS, MODES, PEOPLE, PERSPECTIVES, cellPrompts, defaultPerspectives, gridCount, initialState, problem, type GenderId, type GridId, type ModeId, type PeopleId, type VarState } from "@/lib/variations/prompt";

export type VariationsRun = { prompts: string[]; tier: string };

/** Variations: one picture in, a grid of controlled variations out. Its own panel, its own prompt library (src/lib/variations/prompt.ts). */
export default function VariationsPanel({ thumb, tiers, unit, freeLeft, busy, error, onRun, onClose }: { thumb: string; tiers: string[]; unit: (tier: string) => number | null; freeLeft: number; busy: boolean; error: string; onRun: (run: VariationsRun) => void; onClose: () => void }) {
  const [s, setS] = useState<VarState>(initialState);
  const [consent, setConsent] = useState(false);
  const [tier, setTier] = useState(tiers.includes("2k") ? "2k" : tiers[tiers.length - 1] ?? "1k");
  const n = gridCount(s.grid);
  const patch = (p: Partial<VarState>) => setS((x) => ({ ...x, ...p }));
  const issue = problem(s, consent);
  const cost = unit(tier);
  const sensitive = s.mode === "people";
  const scenesWritten = useMemo(() => s.narrative.split(/\r?\n|;/).filter((l) => l.trim()).length, [s.narrative]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  // a smaller grid trims the picks to fit; a bigger one fills Reframe with the next views in order
  function setGrid(g: GridId) {
    const k = gridCount(g);
    setS((x) => ({
      ...x, grid: g,
      perspectives: x.perspectives.length > k ? x.perspectives.slice(0, k) : x.perspectives.length < k ? [...x.perspectives, ...defaultPerspectives(16).filter((id) => !x.perspectives.includes(id))].slice(0, k) : x.perspectives,
      ethnicities: x.ethnicities.slice(0, k),
    }));
  }
  const toggle = (list: string[], id: string) => list.includes(id) ? list.filter((v) => v !== id) : list.length >= n ? list : [...list, id];

  return (
    <div className="cr-var-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cr-var cr-vars" role="dialog" aria-modal="true" aria-label={FEATURE_NAME}>
        <div className="cr-var-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt="" className="cr-var-thumb" />
          <div><h2>{FEATURE_NAME}</h2><p>One picture, a set of controlled versions</p></div>
          <button type="button" className="cr-var-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="cr-light-label">Mode</div>
        <div className="cr-vars-modes" role="tablist" aria-label="Mode">
          {MODES.map((m) => <button key={m.id} type="button" role="tab" aria-selected={s.mode === m.id} className={s.mode === m.id ? "is-on" : ""} onClick={() => patch({ mode: m.id as ModeId })}>{m.label}</button>)}
        </div>
        <p className="cr-vars-hint">{MODES.find((m) => m.id === s.mode)?.hint}</p>

        {s.mode === "reframe" && (<>
          <div className="cr-light-label cr-vars-count">Perspectives <span>{s.perspectives.length}/{n}</span></div>
          <div className="cr-vars-checks">
            {PERSPECTIVES.map((p) => {
              const on = s.perspectives.includes(p.id);
              return <label key={p.id} className={on ? "is-on" : s.perspectives.length >= n ? "is-off" : ""}><input type="checkbox" checked={on} disabled={!on && s.perspectives.length >= n} onChange={() => patch({ perspectives: toggle(s.perspectives, p.id) })} />{p.label}</label>;
            })}
          </div>
        </>)}

        {s.mode === "storyboard" && (<>
          <div className="cr-light-label cr-vars-count">Narrative
            <label className="cr-vars-auto"><input type="checkbox" checked={s.auto} onChange={(e) => patch({ auto: e.target.checked })} /> Auto</label>
          </div>
          {s.auto
            ? <p className="cr-vars-hint">Eclipse invents a short story with {n} scenes from your picture.</p>
            : <>
                <GrowArea className="cr-var-text" rows={3} value={s.narrative} onChange={(e) => patch({ narrative: e.target.value })} placeholder={"Describe the storyboard, one scene per line\nScene 1: Medium-wide shot of two hikers…"} />
                <p className={`cr-vars-hint${scenesWritten !== n ? " is-warn" : ""}`}>{n} scenes needed, you wrote {scenesWritten}.</p>
              </>}
        </>)}

        {s.mode === "people" && (<>
          <div className="cr-light-label">Change</div>
          <div className="cr-vars-modes" role="tablist" aria-label="What to change">
            {PEOPLE.map((p) => <button key={p.id} type="button" role="tab" aria-selected={s.people === p.id} className={s.people === p.id ? "is-on" : ""} onClick={() => patch({ people: p.id as PeopleId })}>{p.label}</button>)}
          </div>
          <p className="cr-vars-hint">{PEOPLE.find((p) => p.id === s.people)?.hint}{s.people === "age" ? " Adult ages only." : ""}</p>
          {s.people === "demographics" && (<>
            <div className="cr-light-label cr-vars-count">Ethnicity <span>{s.ethnicities.length}/{n}</span></div>
            <div className="cr-vars-checks is-scroll">
              {ETHNICITIES.map((e) => {
                const on = s.ethnicities.includes(e);
                return <label key={e} className={on ? "is-on" : s.ethnicities.length >= n ? "is-off" : ""}><input type="checkbox" checked={on} disabled={!on && s.ethnicities.length >= n} onChange={() => patch({ ethnicities: toggle(s.ethnicities, e) })} />{e}</label>;
              })}
            </div>
            <div className="cr-light-label">Gender</div>
            <div className="cr-vars-modes" role="tablist" aria-label="Gender">
              {GENDERS.map((g) => <button key={g.id} type="button" role="tab" aria-selected={s.gender === g.id} className={s.gender === g.id ? "is-on" : ""} onClick={() => patch({ gender: g.id as GenderId })}>{g.label}</button>)}
            </div>
          </>)}
        </>)}

        {s.mode === "custom" && (<>
          <div className="cr-light-label">Custom</div>
          <GrowArea className="cr-var-text" rows={3} value={s.custom} onChange={(e) => patch({ custom: e.target.value })} placeholder="e.g. hair colour, lighting, tell a story, show different seasons…" />
        </>)}

        {sensitive && (
          <label className="cr-vars-consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> This is my own picture, or the person in it agreed to this.</label>
        )}

        <div className="cr-light-opts">
          <label className="cr-light-chip" aria-label="Grid"><Grid3x3 size={14} /><select value={s.grid} onChange={(e) => setGrid(e.target.value as GridId)}>{GRIDS.map((g) => <option key={g} value={g}>{g}</option>)}</select></label>
          <label className="cr-light-chip" aria-label="Quality"><Maximize2 size={14} /><select value={tier} onChange={(e) => setTier(e.target.value)}>{tiers.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}</select></label>
        </div>

        {(issue || error) && <div className="cr-var-err">{error || issue}</div>}
        <GenerateButton wide price={cost != null ? cost * n : null} free={cost != null && freeLeft >= n} busy={busy} disabled={!!issue} onClick={() => onRun({ prompts: cellPrompts(s), tier })} />
      </div>
    </div>
  );
}
