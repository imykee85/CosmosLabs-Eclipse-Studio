"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Search, Wand2, X } from "lucide-react";
import type { PublicModel } from "@/lib/models";
import SoonTag from "../SoonTag";

export const AUTO = "auto";

// Popular, as laid out for the product. Entries with no `id` have no working model behind them yet (they carry the Soon tag
// and do nothing when tapped); add `id` (and `real`) as each one is connected.
const POPULAR: { label: string; isNew?: boolean }[] = [
  { label: "Cinematic" },
  { label: "Magnific One", isNew: true },
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
  { name: "Magnific", total: 1 },
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
      <span className="mp-name">{m.label}</span>
      {m.isNew && <i className="mp-new">New</i>}
      <SoonTag className="mp-tag" />
    </button>
  );
  const row = (m: PublicModel) => (
    <button key={m.id} type="button" className={`mp-row ${value === m.id ? "is-on" : ""}`} onClick={() => onPick(m.id)}>
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
              {found.map(row)}
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
                    <span>{g.name}</span><em>{g.count} {g.count === 1 ? "model" : "models"}</em><ChevronDown size={16} className={open === g.name ? "is-up" : ""} />
                  </button>
                  {open === g.name && (
                    <div className="mp-list">
                      {g.list.map(row)}
                      {g.soon > 0 && (
                        <button type="button" className="mp-row mp-soon"><span className="mp-name">{g.list.length ? `${g.soon} more ${g.soon === 1 ? "model" : "models"}` : g.soon === 1 ? "1 model" : `${g.soon} models`}</span><SoonTag className="mp-tag" /></button>
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
      <Wand2 size={16} />
      <span className="mp-name">Auto<small>{autoModel ? `Eclipse picks the model. Right now: ${autoModel.label}.` : "Eclipse picks the model for you."}</small></span>
      {value === AUTO && <Check size={16} />}
    </button>
  );
}
