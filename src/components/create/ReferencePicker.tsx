"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useRenders } from "@/lib/use-renders";
import { useUploads } from "@/lib/use-uploads";
import "@/components/library/library.css";
import "@/components/uploads/uploads.css";

// A reference picture the user chose: one of their uploads (Ingredients, Assets) or one of their finished renders.
export type RefPick = { type: "upload" | "render"; id: string; url: string; label: string };

type Tab = "ingredients" | "assets" | "images";
const TABS: { id: Tab; label: string }[] = [{ id: "ingredients", label: "Ingredients" }, { id: "assets", label: "Assets" }, { id: "images", label: "My images" }];

// Dialog for choosing up to `max` pictures to send to the model along with the prompt.
export default function ReferencePicker({ max, picked, onChange, onClose }: { max: number; picked: RefPick[]; onChange: (next: RefPick[]) => void; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("ingredients");
  const ingredients = useUploads("ingredients");
  const assets = useUploads("asset");
  const { renders } = useRenders(undefined, 60);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const has = (type: RefPick["type"], id: string) => picked.some((p) => p.type === type && p.id === id);
  function toggle(item: RefPick) {
    if (has(item.type, item.id)) onChange(picked.filter((p) => !(p.type === item.type && p.id === item.id)));
    else if (picked.length < max) onChange([...picked, item]);
  }

  const items: (RefPick & { sub: string })[] =
    tab === "images"
      ? (renders ?? []).filter((g) => g.status === "completed" && g.imageUrl).map((g) => ({ type: "render" as const, id: g.id, url: g.imageUrl ?? "", label: g.prompt, sub: g.modelLabel ?? "Image" }))
      : ((tab === "ingredients" ? ingredients.items : assets.items) ?? []).map((u) => ({ type: "upload" as const, id: u.id, url: u.imageUrl, label: u.name, sub: u.kind === "asset" ? "Asset" : u.kind[0].toUpperCase() + u.kind.slice(1) }));
  const loading = tab === "images" ? renders === null : (tab === "ingredients" ? ingredients.items : assets.items) === null;
  const error = tab === "ingredients" ? ingredients.error : tab === "assets" ? assets.error : null;

  return (
    <div className="rd-scrim" onClick={onClose}>
      <div className="up-dialog rp-dialog" role="dialog" aria-modal="true" aria-label="Choose reference pictures" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="rd-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <h2>Reference pictures</h2>
        <p className="rp-note">Choose up to {max}. The model uses them as a starting point for your prompt. <b>{picked.length} of {max}</b> chosen.</p>
        <div className="lib-roles" role="tablist" aria-label="Where from">
          {TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "is-active" : ""} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </div>
        {error && <p className="up-error" role="alert">{error}</p>}
        {loading ? <p className="rp-note">Loading…</p> : items.length === 0 ? (
          <p className="rp-note">{tab === "images" ? "You have no finished images yet." : `Nothing here yet. Add pictures on the ${tab === "ingredients" ? "Ingredients" : "Assets"} page.`}</p>
        ) : (
          <div className="rp-grid">
            {items.map((it) => {
              const on = has(it.type, it.id);
              return (
                <button key={`${it.type}-${it.id}`} type="button" className={`rp-item ${on ? "is-on" : ""}`} aria-pressed={on} disabled={!on && picked.length >= max} onClick={() => toggle(it)} title={it.label}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.url} alt={it.label} loading="lazy" />
                  {on && <span className="rp-check"><Check size={14} /></span>}
                  <span className="rp-name">{it.label}</span><small>{it.sub}</small>
                </button>
              );
            })}
          </div>
        )}
        <button type="button" className="ws-add" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
