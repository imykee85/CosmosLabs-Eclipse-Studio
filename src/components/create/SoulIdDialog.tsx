"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Plus, ScanFace, Trash2, X } from "lucide-react";
import ReferencePicker, { type RefPick } from "./ReferencePicker";
import { fallbackTo, thumbOf } from "@/lib/thumb-url";

export type SoulIdItem = { id: string; name: string; modelVersion: string; status: string; error: string | null; imageCount: number; thumb: { type: "upload" | "render"; id: string } | null };
const VERSION_LABEL: Record<string, string> = { v1: "Soul", v2: "Soul 2", cinema: "Soul Cinema" };

// Soul ID: choose a trained character for this Soul model (or none), set how strongly it is followed, or train a new one from 5 to 30 pictures
// of the same person. Training runs at Higgsfield and takes a while; the list checks on it each time it is opened.
export default function SoulIdDialog({ version, selected, strength, onPick, onStrength, onClose }: {
  version: "v1" | "v2" | "cinema"; selected: string | null; strength: number;
  onPick: (id: string | null, name?: string) => void; onStrength: (v: number) => void; onClose: () => void;
}) {
  const [items, setItems] = useState<SoulIdItem[] | null>(null);
  const [error, setError] = useState("");
  const [training, setTraining] = useState(false);
  const [name, setName] = useState("");
  const [pics, setPics] = useState<RefPick[]>([]);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/soul-ids", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(r.status === 503 ? "Soul ID needs an account (preview mode has none)." : d.error ?? "Could not load your Soul IDs."); setItems([]); return; }
      setItems(Array.isArray(d.items) ? d.items : []);
    } catch { setError("Could not load your Soul IDs."); setItems([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!items?.some((i) => i.status === "pending")) return; const t = setTimeout(load, 15000); return () => clearTimeout(t); }, [items, load]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !picking) onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose, picking]);

  async function train() {
    if (busy || !name.trim() || pics.length < 5) return;
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/soul-ids", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), version, pictures: pics.map((p) => ({ type: p.type, id: p.id })) }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(typeof d.error === "string" ? d.error : "Training could not start."); return; }
      setTraining(false); setName(""); setPics([]); await load();
    } finally { setBusy(false); }
  }
  async function remove(id: string) {
    await fetch(`/api/soul-ids/${id}`, { method: "DELETE" });
    if (selected === id) onPick(null);
    await load();
  }
  const mine = (items ?? []).filter((i) => i.modelVersion === version);

  return (
    <div className="rd-scrim" onClick={onClose}>
      <div className="up-dialog rp-dialog sid" role="dialog" aria-modal="true" aria-label="Soul ID" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="rd-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <h2><ScanFace size={18} aria-hidden="true" /> Soul ID</h2>
        <p className="rp-note">A character trained from your own pictures, kept the same in every {VERSION_LABEL[version]} image.</p>
        {error && <p className="up-error" role="alert">{error}</p>}
        {!training ? (
          <>
            <ul className="sid-list">
              <li className={!selected ? "is-on" : ""}><button type="button" onClick={() => { onPick(null); onClose(); }}><span className="sid-pic sid-none" /> <b>None</b>{!selected && <Check size={15} />}</button></li>
              {items === null ? <li className="sid-wait"><Loader2 size={15} className="cr-spin" /> Loading…</li> : mine.map((i) => (
                <li key={i.id} className={selected === i.id ? "is-on" : ""}>
                  <button type="button" disabled={i.status !== "completed"} onClick={() => { onPick(i.id, i.name); onClose(); }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {i.thumb ? <img className="sid-pic" src={thumbOf(i.thumb.type, i.thumb.id)} onError={fallbackTo(null)} alt="" /> : <span className="sid-pic" />}
                    <span><b>{i.name}</b><small>{i.status === "completed" ? `${i.imageCount} pictures` : i.status === "pending" ? "Training…" : i.error ?? "Training failed"}</small></span>
                    {selected === i.id && <Check size={15} />}
                  </button>
                  <button type="button" className="sid-del" aria-label={`Remove ${i.name}`} onClick={() => void remove(i.id)}><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
            {selected && (
              <label className="sid-strength">How closely to follow it <em>{Math.round(strength * 100)}%</em>
                <input type="range" min={0.1} max={1} step={0.05} value={strength} onChange={(e) => onStrength(Number(e.target.value))} aria-label="Soul ID strength" />
              </label>
            )}
            <button type="button" className="cr-chip sid-new" onClick={() => setTraining(true)}><Plus size={14} /> Train a new Soul ID</button>
          </>
        ) : (
          <div className="sid-train">
            <label className="sid-field">Name<input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="For example Maya" /></label>
            <button type="button" className="cr-chip" onClick={() => setPicking(true)}><Plus size={14} /> {pics.length ? `${pics.length} pictures chosen` : "Choose 5 to 30 pictures of the same person"}</button>
            {pics.length > 0 && (
              <div className="sid-pics">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {pics.map((p) => <img key={`${p.type}-${p.id}`} src={thumbOf(p.type, p.id)} onError={fallbackTo(p.url)} alt={p.label} />)}
              </div>
            )}
            <div className="sid-actions">
              <button type="button" className="cr-chip" onClick={() => setTraining(false)}>Back</button>
              <button type="button" className="cr-go sid-go" disabled={busy || !name.trim() || pics.length < 5} onClick={() => void train()}>{busy ? <Loader2 size={15} className="cr-spin" /> : null} Train for {VERSION_LABEL[version]}</button>
            </div>
          </div>
        )}
        {picking && <ReferencePicker max={30} picked={pics} onChange={setPics} onClose={() => setPicking(false)} note="Choose 5 to 30 clear pictures of the same person: different angles and light, face visible, nobody else in them." />}
      </div>
    </div>
  );
}
