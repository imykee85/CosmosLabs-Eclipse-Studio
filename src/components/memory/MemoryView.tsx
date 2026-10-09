"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUp, Brain, ChevronLeft, Folder, Heart, Package, Palette, Plus, Trash2, Upload, User, X } from "lucide-react";
import ConnectNav from "@/components/connect/ConnectNav";
import { MEMORY_TEXT_MAX, MEMORY_TOPICS, TOPIC_LABEL, type MemoryItem, type MemoryTopic } from "@/lib/memory";
import "@/components/connect/connect.css";
import "./memory.css";

// Memory: what Eclipse remembers about you and your work, so every new chat starts informed. The assistant reads it at the
// start of a chat and saves new facts itself when you tell it something lasting; you can add, import and delete here.
const ICON: Record<MemoryTopic, React.ReactNode> = {
  projects: <Folder size={20} />, products: <Package size={20} />, characters: <User size={20} />, style: <Palette size={20} />, tastes: <Heart size={20} />,
};
const POS: Record<MemoryTopic, { x: number; y: number }> = {
  projects: { x: 40, y: 38 }, products: { x: 76, y: 45 }, characters: { x: 20, y: 52 }, style: { x: 76, y: 63 }, tastes: { x: 40, y: 70 },
};

export default function MemoryView() {
  const [items, setItems] = useState<MemoryItem[] | null>(null);
  const [topic, setTopic] = useState<MemoryTopic | "all">("all");
  const [text, setText] = useState("");
  const [saveTopic, setSaveTopic] = useState<MemoryTopic>("tastes");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [paste, setPaste] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/memory", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setItems(data.items); else { setItems([]); setError(res.status === 503 ? "Sign in to keep a memory." : data.error ?? "Could not load your memory."); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(MEMORY_TOPICS.map((t) => [t, 0])) as Record<MemoryTopic, number>;
    for (const i of items ?? []) c[i.topic]++;
    return c;
  }, [items]);
  const shown = (items ?? []).filter((i) => topic === "all" || i.topic === topic);

  async function add() {
    const t = text.trim();
    if (!t || saving) return;
    setSaving(true); setError("");
    const res = await fetch("/api/memory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: saveTopic, text: t }) });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Could not save that."); return; }
    setText("");
    setItems((l) => [data, ...(l ?? [])]);
  }
  async function remove(id: string) {
    setItems((l) => l?.filter((i) => i.id !== id) ?? null);
    const res = await fetch(`/api/memory/${id}`, { method: "DELETE" });
    if (!res.ok) { setError("Could not delete that."); load(); }
  }
  async function runImport() {
    if (!paste.trim() || saving) return;
    setSaving(true); setError("");
    const res = await fetch("/api/memory/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: saveTopic, text: paste }) });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Could not import."); return; }
    setPaste(""); setImporting(false);
    load();
  }

  return (
    <div className="mm-wrap">
      <div className="mm-top">
        <div className="mm-left">
          <Link href="/connect" className="mm-back" aria-label="Back to Connect"><ChevronLeft size={24} /></Link>
          <span className="mm-title"><Brain size={18} /> Memory</span>
        </div>
        <button type="button" className="mm-import" onClick={() => setImporting(true)}><Upload size={15} /> Import</button>
      </div>

      <div className="mm-stage">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {MEMORY_TOPICS.map((t) => <line key={t} x1={50} y1={52} x2={POS[t].x} y2={POS[t].y} />)}
        </svg>
        {MEMORY_TOPICS.map((t) => (
          <button key={t} type="button" className={`mm-node ${topic === t ? "is-on" : ""}`} style={{ left: `${POS[t].x}%`, top: `${POS[t].y}%` }}
            title={`${TOPIC_LABEL[t]} (${counts[t]})`} aria-pressed={topic === t} onClick={() => setTopic(topic === t ? "all" : t)}>
            {ICON[t]}{counts[t] > 0 && <i>{counts[t]}</i>}
          </button>
        ))}
        <span className="mm-orb" aria-hidden="true" />
      </div>

      <div className="mm-copy">
        <h1>Your creative memory</h1>
        <p>{items === null ? "Loading…" : items.length === 0 ? "Nothing remembered yet" : `${items.length} thing${items.length > 1 ? "s" : ""} remembered`}</p>
      </div>

      <div className="mm-side">
        <ConnectNav current="/memory" />
        <div className="mm-tabs" role="tablist" aria-label="Topic">
          <button type="button" className={topic === "all" ? "is-on" : ""} onClick={() => setTopic("all")}>All</button>
          {MEMORY_TOPICS.map((t) => <button key={t} type="button" className={topic === t ? "is-on" : ""} onClick={() => setTopic(t)}>{TOPIC_LABEL[t]}</button>)}
        </div>
        <ul className="mm-list">
          {shown.map((i) => (
            <li key={i.id}>
              <span className="mm-tag">{TOPIC_LABEL[i.topic]}</span>
              <span className="mm-text">{i.text}</span>
              {i.source === "agent" && <small>saved by the assistant</small>}
              <button type="button" aria-label="Forget this" onClick={() => remove(i.id)}><Trash2 size={15} /></button>
            </li>
          ))}
          {items !== null && shown.length === 0 && <li className="mm-none">{items.length === 0 ? "Tell the assistant about your products, characters and style, or add notes below." : "Nothing under this topic."}</li>}
        </ul>
      </div>

      {error && <p className="mm-error" role="alert">{error}</p>}
      <form className="mm-add" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <button type="button" className="mm-plus" aria-label="Import notes" onClick={() => setImporting(true)}><Plus size={18} /></button>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={MEMORY_TEXT_MAX} placeholder="Add a memory" aria-label="Add a memory" />
        <select value={saveTopic} onChange={(e) => setSaveTopic(e.target.value as MemoryTopic)} aria-label="Topic for this memory">
          {MEMORY_TOPICS.map((t) => <option key={t} value={t}>{TOPIC_LABEL[t]}</option>)}
        </select>
        <button type="submit" className="mm-send" aria-label="Save memory" disabled={!text.trim() || saving}><ArrowUp size={18} /></button>
      </form>

      {importing && (
        <div className="cn-modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && setImporting(false)}>
          <div className="cn-modal" role="dialog" aria-label="Import notes">
            <h2>Import notes</h2>
            <p>Paste your notes, one fact per line. Each line becomes a memory under the topic you choose.</p>
            <label className="cn-field">Topic
              <select value={saveTopic} onChange={(e) => setSaveTopic(e.target.value as MemoryTopic)}>{MEMORY_TOPICS.map((t) => <option key={t} value={t}>{TOPIC_LABEL[t]}</option>)}</select>
            </label>
            <label className="cn-field">Notes<textarea rows={8} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"Our brand colours are deep red and charcoal\nNever show the product on a white background"} /></label>
            <div className="cn-actions">
              <button type="button" className="cn-btn" onClick={() => setImporting(false)}><X size={14} /> Cancel</button>
              <button type="button" className="cn-btn is-red" disabled={!paste.trim() || saving} onClick={runImport}>Import</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
