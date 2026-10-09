"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Clapperboard, Search, Wand2, X } from "lucide-react";
import { siAlibabacloud, siBytedance, siGoogle, siOpenai, siX, type SimpleIcon } from "simple-icons";
import ConnectMark from "../ConnectMark";
import type { PublicModel } from "@/lib/models";
import SoonTag from "../SoonTag";

export const AUTO = "auto";

// Small logo tile beside each name. Marks come from the open Simple Icons set where the maker is in it (one colour per brand);
// everything else gets a plain letter tile until real artwork is added. All marks belong to their owners.
type Tile = { icon: SimpleIcon; bg: string; fg: string };
const TILES: Record<string, Tile> = {
  Google: { icon: siGoogle, bg: "#ffffff", fg: "#4285f4" },
  GPT: { icon: siOpenai, bg: "#202123", fg: "#ffffff" },
  Seedream: { icon: siBytedance, bg: "#ffffff", fg: "#3c8cff" },
  Qwen: { icon: siAlibabacloud, bg: "#ff6a00", fg: "#ffffff" },
  Grok: { icon: siX, bg: "#000000", fg: "#ffffff" },
};
function ModelIcon({ name }: { name: string }) {
  const t = TILES[name];
  if (name === "Eclipse Studio V1" || name === "Soul") return <span className="mp-ico mp-ico-brand"><ConnectMark size={18} /></span>;
  if (name === "Cinematic") return <span className="mp-ico"><Clapperboard size={16} /></span>;
  if (!t) return <span className="mp-ico mp-ico-letter">{name.replace(/^Google |^Eclipse /, "").charAt(0)}</span>;
  return <span className="mp-ico" style={{ background: t.bg, color: t.fg }}><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d={t.icon.path} /></svg></span>;
}
// Which tile a popular entry or a model uses.
const popularTile = (label: string) => (label.startsWith("Google") ? "Google" : label.startsWith("GPT") ? "GPT" : label.startsWith("Seedream") ? "Seedream" : label);

// Popular, as laid out for the product. Entries with no `id` have no working model behind them yet (they carry the Soon tag
// and do nothing when tapped); add `id` (and `real`) as each one is connected.
const POPULAR: { label: string; isNew?: boolean }[] = [
  { label: "Cinematic" },
  { label: "Eclipse Studio V1", isNew: true },
  { label: "Google Nano Banana 2.1", isNew: true },
  { label: "GPT 2.5", isNew: true },
  { label: "Seedream 5 Pro", isNew: true },
];

// All models, grouped by maker, with the model counts the product lists. `match` finds the models Eclipse can really run in
// each group; the rest of a group's count is shown as "more models" with the Soon tag. Eclipse's own groups (Soul, Marketing
// Studio) are not in the list from the screenshot; they sit first because they are the models that work today.
const GROUPS: { name: string; total: number; match?: (id: string) => boolean }[] = [
  { name: "Soul", total: 0, match: (id) => id.startsWith("soul") },
  { name: "Marketing Studio", total: 0, match: (id) => id.startsWith("marketing_studio") || id === "ads_studio" },
  { name: "Google", total: 5 },
  { name: "GPT", total: 6 },
  { name: "Seedream", total: 6 },
  { name: "Flux", total: 11 },
  { name: "Mystic", total: 4 },
  { name: "Ideogram", total: 4, match: (id) => id.startsWith("ideogram") },
  { name: "Luma", total: 1 },
  { name: "Runway", total: 1 },
  { name: "Classic", total: 2 },
  { name: "Z-Image", total: 1, match: (id) => id.startsWith("z_image") },
  { name: "Qwen", total: 3, match: (id) => id.startsWith("qwen") },
  { name: "Grok", total: 2, match: (id) => id.startsWith("grok") },
  { name: "Recraft", total: 3, match: (id) => id.startsWith("recraft") },
  { name: "Krea", total: 1 },
  { name: "Microsoft", total: 1 },
];

export default function ModelPicker({ models, value, autoModel, onPick, onClose }: {
  models: PublicModel[]; value: string; autoModel: PublicModel | null; onPick: (id: string) => void; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const groups = useMemo(() => GROUPS.map((g) => {
    const list = g.match ? models.filter((m) => g.match!(m.id)) : [];
    return { name: g.name, list, soon: Math.max(0, g.total - list.length), count: Math.max(g.total, list.length) };
  }).filter((g) => g.count > 0), [models]);
  const term = q.trim().toLowerCase();
  const found = term ? models.filter((m) => `${m.label} ${m.blurb}`.toLowerCase().includes(term)) : [];
  const foundSoon = term ? POPULAR.filter((m) => m.label.toLowerCase().includes(term)) : [];
  const showAuto = !term || "auto".includes(term);

  const soonRow = (m: { label: string; isNew?: boolean }) => (
    <button key={m.label} type="button" className="mp-row mp-soon">
      <ModelIcon name={popularTile(m.label)} />
      <span className="mp-name">{m.label}</span>
      {m.isNew && <i className="mp-new">New</i>}
      <SoonTag className="mp-tag" />
    </button>
  );
  const row = (m: PublicModel, group?: string) => (
    <button key={m.id} type="button" className={`mp-row ${value === m.id ? "is-on" : ""}`} onClick={() => onPick(m.id)}>
      <ModelIcon name={group ?? GROUPS.find((g) => g.match?.(m.id))?.name ?? m.label} />
      <span className="mp-name">{m.label}{m.blurb && <small>{m.blurb}</small>}</span>
      {value === m.id && <Check size={16} />}
    </button>
  );

  return (
    <div className="mp-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mp-sheet" role="dialog" aria-label="Model">
        <header className="mp-head"><h2>Model</h2><button type="button" aria-label="Close" onClick={onClose}><X size={18} /></button></header>
        <label className="mp-search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search models" /></label>
        <div className="mp-body">
          {term ? (
            <>
              {showAuto && <AutoRow value={value} autoModel={autoModel} onPick={onPick} />}
              {found.map((m) => row(m))}
              {foundSoon.map(soonRow)}
              {!found.length && !foundSoon.length && !showAuto && <p className="mp-none">No model matches &ldquo;{q}&rdquo;.</p>}
            </>
          ) : (
            <>
              <h3>Popular</h3>
              <AutoRow value={value} autoModel={autoModel} onPick={onPick} />
              {POPULAR.map(soonRow)}
              <h3>All models</h3>
              {groups.map((g) => (
                <div key={g.name} className="mp-group">
                  <button type="button" className="mp-gh" aria-expanded={open === g.name} onClick={() => setOpen(open === g.name ? null : g.name)}>
                    <ModelIcon name={g.name} /><span>{g.name}</span><em>{g.count} {g.count === 1 ? "model" : "models"}</em><ChevronDown size={16} className={open === g.name ? "is-up" : ""} />
                  </button>
                  {open === g.name && (
                    <div className="mp-list">
                      {g.list.map((m) => row(m, g.name))}
                      {g.soon > 0 && (
                        <button type="button" className="mp-row mp-soon"><ModelIcon name={g.name} /><span className="mp-name">{g.list.length ? `${g.soon} more ${g.soon === 1 ? "model" : "models"}` : g.soon === 1 ? "1 model" : `${g.soon} models`}</span><SoonTag className="mp-tag" /></button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AutoRow({ value, autoModel, onPick }: { value: string; autoModel: PublicModel | null; onPick: (id: string) => void }) {
  return (
    <button type="button" className={`mp-row ${value === AUTO ? "is-on" : ""}`} onClick={() => onPick(AUTO)}>
      <span className="mp-ico"><Wand2 size={16} /></span>
      <span className="mp-name">Auto<small>{autoModel ? `Eclipse picks the model. Right now: ${autoModel.label}.` : "Eclipse picks the model for you."}</small></span>
      {value === AUTO && <Check size={16} />}
    </button>
  );
}
