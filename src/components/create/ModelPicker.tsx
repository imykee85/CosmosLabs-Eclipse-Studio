"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Search, Wand2, X } from "lucide-react";
import type { PublicModel } from "@/lib/models";

export const AUTO = "auto";

// The models listed under Popular, in this order, when the server offers them.
const POPULAR = ["soul_v2", "grok_image_2", "marketing_studio_image", "ideogram_4", "recraft_v4_1"];

// Models are grouped by family for the All models list.
const FAMILIES: { name: string; match: (id: string) => boolean }[] = [
  { name: "Soul", match: (id) => id.startsWith("soul") },
  { name: "Marketing Studio", match: (id) => id.startsWith("marketing_studio") || id === "ads_studio" },
  { name: "Grok", match: (id) => id.startsWith("grok") },
  { name: "Recraft", match: (id) => id.startsWith("recraft") },
  { name: "Qwen", match: (id) => id.startsWith("qwen") },
  { name: "Ideogram", match: (id) => id.startsWith("ideogram") },
  { name: "Z-Image", match: (id) => id.startsWith("z_image") },
];

export default function ModelPicker({ models, value, autoModel, onPick, onClose }: {
  models: PublicModel[]; value: string; autoModel: PublicModel | null; onPick: (id: string) => void; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const popular = useMemo(() => POPULAR.map((id) => models.find((m) => m.id === id)).filter((m): m is PublicModel => !!m), [models]);
  const groups = useMemo(() => {
    const used = new Set<string>();
    const out = FAMILIES.map((f) => {
      const list = models.filter((m) => f.match(m.id));
      list.forEach((m) => used.add(m.id));
      return { name: f.name, list };
    }).filter((g) => g.list.length);
    const rest = models.filter((m) => !used.has(m.id));
    if (rest.length) out.push({ name: "Other", list: rest });
    return out;
  }, [models]);
  const term = q.trim().toLowerCase();
  const found = term ? models.filter((m) => `${m.label} ${m.blurb}`.toLowerCase().includes(term)) : [];
  const showAuto = !term || "auto".includes(term);

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
              {!found.length && !showAuto && <p className="mp-none">No model matches &ldquo;{q}&rdquo;.</p>}
            </>
          ) : (
            <>
              <h3>Popular</h3>
              <AutoRow value={value} autoModel={autoModel} onPick={onPick} />
              {popular.map(row)}
              <h3>All models</h3>
              {groups.map((g) => (
                <div key={g.name} className="mp-group">
                  <button type="button" className="mp-gh" aria-expanded={open === g.name} onClick={() => setOpen(open === g.name ? null : g.name)}>
                    <span>{g.name}</span><em>{g.list.length} {g.list.length === 1 ? "model" : "models"}</em><ChevronDown size={16} className={open === g.name ? "is-up" : ""} />
                  </button>
                  {open === g.name && <div className="mp-list">{g.list.map(row)}</div>}
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
