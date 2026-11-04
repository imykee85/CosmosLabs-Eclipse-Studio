"use client";

import { Grid3x3, Loader2, Maximize2, RectangleHorizontal } from "lucide-react";
import GrowArea from "@/components/GrowArea";
import { ETHNICITIES, GENDERS, GRIDS, MODES, PEOPLE, PERSPECTIVES, defaultPerspectives, gridCount, parseScenes, pixelsFor, type GenderId, type GridId, type ModeId, type PeopleId, type VarState } from "@/lib/variations/prompt";

/** The controls of Variations, shared by the panel and the Canvas node: mode, the mode's own options, the consent tick for People, and the grid, aspect ratio and quality chips. */
export default function VariationsForm({ s, setS, consent, setConsent, tiers, ratios, refSize, storyBusy, onWriteStory, compact = false }: {
  s: VarState; setS: (f: (x: VarState) => VarState) => void; consent: boolean; setConsent: (v: boolean) => void;
  tiers: string[]; ratios: string[]; refSize?: { w: number; h: number } | null; storyBusy?: boolean; onWriteStory?: () => void; compact?: boolean;
}) {
  const n = gridCount(s.grid);
  const patch = (p: Partial<VarState>) => setS((x) => ({ ...x, ...p }));
  const written = parseScenes(s.narrative).length;
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((v) => v !== id) : list.length >= n ? list : [...list, id]);
  // a smaller grid trims the picks to fit; a bigger one fills Reframe with the next views in order
  function setGrid(g: GridId) {
    const k = gridCount(g);
    setS((x) => ({
      ...x, grid: g,
      perspectives: x.perspectives.length > k ? x.perspectives.slice(0, k) : x.perspectives.length < k ? [...x.perspectives, ...defaultPerspectives(16).filter((id) => !x.perspectives.includes(id))].slice(0, k) : x.perspectives,
      ethnicities: x.ethnicities.slice(0, k),
    }));
  }
  const px = pixelsFor(s.tier, s.ratio, refSize);
  return (
    <div className={`cr-vf${compact ? " is-compact" : ""}`}>
      <div className="cr-light-label">Mode</div>
      <div className="cr-vars-modes nodrag" role="tablist" aria-label="Mode">
        {MODES.map((m) => <button key={m.id} type="button" role="tab" aria-selected={s.mode === m.id} className={s.mode === m.id ? "is-on" : ""} onClick={() => patch({ mode: m.id as ModeId })}>{m.label}</button>)}
      </div>
      <p className="cr-vars-hint">{MODES.find((m) => m.id === s.mode)?.hint}</p>

      {s.mode === "reframe" && (<>
        <div className="cr-light-label cr-vars-count">Perspectives <span>{s.perspectives.length}/{n}</span></div>
        <div className="cr-vars-checks nodrag">
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
        <GrowArea className="cr-var-text nodrag nowheel" rows={3} value={s.narrative} onChange={(e) => patch({ narrative: e.target.value })} placeholder={s.auto ? "Eclipse writes the story from your picture. You can edit it before you generate." : "Describe the storyboard, one scene per line\nScene 1: Medium-wide shot of two hikers…"} />
        {s.auto && onWriteStory && <button type="button" className="cr-vars-story nodrag" disabled={storyBusy} onClick={onWriteStory}>{storyBusy ? <><Loader2 size={14} className="gen-spin" /> Writing</> : s.narrative.trim() ? "Write it again" : "Write the story"}</button>}
        <p className={`cr-vars-hint${written > 0 && written !== n ? " is-warn" : ""}`}>{n} scenes needed{written ? `, you have ${written}` : ""}.</p>
      </>)}

      {s.mode === "people" && (<>
        <div className="cr-light-label">Change</div>
        <div className="cr-vars-modes nodrag" role="tablist" aria-label="What to change">
          {PEOPLE.map((p) => <button key={p.id} type="button" role="tab" aria-selected={s.people === p.id} className={s.people === p.id ? "is-on" : ""} onClick={() => patch({ people: p.id as PeopleId })}>{p.label}</button>)}
        </div>
        <p className="cr-vars-hint">{PEOPLE.find((p) => p.id === s.people)?.hint}{s.people === "age" ? " Adult ages only." : ""}</p>
        {s.people === "demographics" && (<>
          <div className="cr-light-label cr-vars-count">Ethnicity <span>{s.ethnicities.length}/{n}</span></div>
          <div className="cr-vars-checks is-scroll nodrag nowheel">
            {ETHNICITIES.map((e) => {
              const on = s.ethnicities.includes(e);
              return <label key={e} className={on ? "is-on" : s.ethnicities.length >= n ? "is-off" : ""}><input type="checkbox" checked={on} disabled={!on && s.ethnicities.length >= n} onChange={() => patch({ ethnicities: toggle(s.ethnicities, e) })} />{e}</label>;
            })}
          </div>
          <div className="cr-light-label">Gender</div>
          <div className="cr-vars-modes nodrag" role="tablist" aria-label="Gender">
            {GENDERS.map((g) => <button key={g.id} type="button" role="tab" aria-selected={s.gender === g.id} className={s.gender === g.id ? "is-on" : ""} onClick={() => patch({ gender: g.id as GenderId })}>{g.label}</button>)}
          </div>
        </>)}
        <label className="cr-vars-consent nodrag"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> This is my own picture, or the person in it agreed to this.</label>
      </>)}

      {s.mode === "custom" && (<>
        <div className="cr-light-label">Custom</div>
        <GrowArea className="cr-var-text nodrag nowheel" rows={3} value={s.custom} onChange={(e) => patch({ custom: e.target.value })} placeholder="e.g. hair colour, lighting, tell a story, show different seasons…" />
      </>)}

      <div className="cr-light-opts nodrag">
        <label className="cr-light-chip" aria-label="Aspect ratio"><RectangleHorizontal size={14} /><select value={s.ratio} onChange={(e) => patch({ ratio: e.target.value })}>{ratios.map((r) => <option key={r} value={r}>{r === "auto" ? "Auto" : r}</option>)}</select></label>
        <label className="cr-light-chip" aria-label="Grid"><Grid3x3 size={14} /><select value={s.grid} onChange={(e) => setGrid(e.target.value as GridId)}>{GRIDS.map((g) => <option key={g} value={g}>{g}</option>)}</select></label>
        <label className="cr-light-chip" aria-label="Quality"><Maximize2 size={14} /><select value={s.tier} onChange={(e) => patch({ tier: e.target.value })}>{tiers.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}</select></label>
      </div>
      <p className="cr-vars-hint">Every picture is made at full quality{px ? `, about ${px} px each` : ""}.</p>
    </div>
  );
}
