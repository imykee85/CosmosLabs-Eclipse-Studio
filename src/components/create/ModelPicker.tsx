"use client";

import { useMemo, useState } from "react";
import { Box, Check, ChevronDown, Megaphone, ScanFace, Search, Video, Wand2, X, Zap, type LucideIcon } from "lucide-react";
import { siGoogle, siOpenai } from "simple-icons";
import type { PublicModel } from "@/lib/models";
import SoonTag from "../SoonTag";

export const AUTO = "auto";

// One-colour icon beside each name, like the product reference: the real marks for Google and OpenAI (Simple Icons set) and
// plain one-colour drawings for the rest, drawn here as stand-ins until official artwork is added. All marks belong to their owners.
const LUCIDE: Record<string, LucideIcon> = { Auto: Wand2, "Eclipse Studio V1": Video, Soul: ScanFace, "Marketing Studio": Megaphone, Luma: Box, Classic: Zap };
const Stroke = ({ children }: { children: React.ReactNode }) => <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</g>;
const Letter = ({ c, x = 12, y = 17.5, size = 15 }: { c: string; x?: number; y?: number; size?: number }) => <text x={x} y={y} textAnchor="middle" fontSize={size} fontWeight="800" fontFamily="Inter, system-ui, sans-serif" fill="currentColor">{c}</text>;
const DRAWN: Record<string, React.ReactNode> = {
  Google: <path fill="currentColor" d={siGoogle.path} />,
  GPT: <path fill="currentColor" d={siOpenai.path} />,
  Seedream: <g fill="currentColor"><rect x="3" y="10" width="3" height="8" rx="1.2" /><rect x="8" y="5" width="3" height="14" rx="1.2" /><rect x="13" y="8" width="3" height="11" rx="1.2" /><rect x="18" y="12" width="3" height="6" rx="1.2" /></g>,
  Flux: <Stroke><path d="M2.5 19L9 6l6.5 13M9.5 19l4-8 4 8" /></Stroke>,
  Mystic: <Stroke><path d="M12 4L21 19H3z" /></Stroke>,
  Ideogram: <Stroke><path d="M3.5 8c3-3 5 3 8.5 0s5 3 8.5 0M3.5 15c3-3 5 3 8.5 0s5 3 8.5 0" /></Stroke>,
  Runway: <><Stroke><rect x="3" y="3" width="18" height="18" rx="5" /></Stroke><Letter c="R" y={16.5} size={12} /></>,
  "Z-Image": <Letter c="Z" size={18} y={18} />,
  Qwen: <Stroke><path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z" /><path d="M12 8.2l3.9 2.2v4.4L12 17l-3.9-2.2v-4.4z" /></Stroke>,
  Grok: <Stroke><circle cx="12" cy="12" r="8" /><path d="M7 17.5L17.5 7" /></Stroke>,
  Recraft: <Letter c="R" size={18} y={18} />,
  Krea: <Letter c="K" size={18} y={18} />,
  Microsoft: <g fill="currentColor"><rect x="3.5" y="3.5" width="8" height="8" rx="1" /><rect x="12.5" y="3.5" width="8" height="8" rx="1" /><rect x="3.5" y="12.5" width="8" height="8" rx="1" /><rect x="12.5" y="12.5" width="8" height="8" rx="1" /></g>,
};
function ModelIcon({ name }: { name: string }) {
  const L = LUCIDE[name];
  if (L) return <span className="mp-ico"><L size={20} strokeWidth={1.8} /></span>;
  return <span className="mp-ico"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">{DRAWN[name] ?? <Stroke><circle cx="12" cy="12" r="8" /></Stroke>}</svg></span>;
}
// Which icon a popular entry uses.
const popularTile = (label: string) => (label.startsWith("Google") ? "Google" : label.startsWith("GPT") ? "GPT" : label.startsWith("Seedream") ? "Seedream" : label);

// Popular, as laid out for the product. Entries with no `id` have no working model behind them yet (they carry the Soon tag
// and do nothing when tapped); add `id` (and `real`) as each one is connected.
const POPULAR: { label: string; isNew?: boolean }[] = [
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
      <ModelIcon name="Auto" />
      <span className="mp-name">Auto<small>Eclipse picks the best fitting model for each image.</small></span>
      {value === AUTO && <Check size={16} />}
    </button>
  );
}
