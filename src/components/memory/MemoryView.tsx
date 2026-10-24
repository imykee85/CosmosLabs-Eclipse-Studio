"use client";

import GlowOrb from "@/components/GlowOrb";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Brain, ChevronLeft, Folder, Heart, Package, Palette, Plus, Trash2, Upload, User, X } from "lucide-react";
import ConnectNav from "@/components/connect/ConnectNav";
import ImportMemoryDialog from "./ImportMemoryDialog";
import { MEMORY_FILE_MAX_BYTES, MEMORY_TEXT_MAX, MEMORY_TOPICS, TOPIC_LABEL, memoryFileToText, type MemoryItem, type MemoryTopic } from "@/lib/memory";
import "@/components/connect/connect.css";
import "./memory.css";

// Memory: what Eclipse remembers about you and your work, so every new chat starts informed. The assistant reads it at the
// start of a chat and saves new facts itself when you tell it something lasting; you can add, import and delete here.
const ICON: Record<MemoryTopic, React.ReactNode> = {
  projects: <Folder size={20} />, products: <Package size={20} />, characters: <User size={20} />, style: <Palette size={20} />, tastes: <Heart size={20} />,
};
// The homepage's Core animation (owner 2026-10-15): two dashed rings turning opposite ways round the glowing core, with the five
// topics travelling on them. Each ring turns one way and its nodes turn back at the same speed, so the icons stay upright.
const RING: Record<MemoryTopic, { ring: 0 | 1; angle: number }> = {
  projects: { ring: 0, angle: -30 }, products: { ring: 0, angle: 90 }, style: { ring: 0, angle: 210 },
  characters: { ring: 1, angle: 30 }, tastes: { ring: 1, angle: 210 },
};
const OUTER_S = 60, INNER_S = 44;

export default function MemoryView() {
  const [items, setItems] = useState<MemoryItem[] | null>(null);
  const [topic, setTopic] = useState<MemoryTopic | "all">("all");
  const [text, setText] = useState("");
  const [saveTopic, setSaveTopic] = useState<MemoryTopic>("tastes");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false); // phones: the history sheet (hidden until swiped up)
  const touch = useRef<{ x: number; y: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

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
  // The + adds memories from a file: a text file (.txt, .md, .csv or .json) or a Word file is read line by line here, a PDF or a picture is read by
  // the assistant (/api/memory/extract), which answers with labelled lines. Each line becomes a memory under the chosen topic, and lines that start
  // with a label such as "Style:" go under that topic.
  async function uploadFile(file: File | undefined) {
    if (!file || saving) return;
    setError(""); setNotice("");
    const isDocx = /\.docx$/i.test(file.name);
    const isRead = /\.pdf$/i.test(file.name) || /^image\/(png|jpeg|webp)$/.test(file.type);
    const isText = /\.(txt|md|markdown|csv|json)$/i.test(file.name) || file.type.startsWith("text/");
    if (!isDocx && !isRead && !isText) { setError("Upload a text file (.txt, .md, .csv, .json), a Word file, a PDF or a picture."); return; }
    if (isText && file.size > MEMORY_FILE_MAX_BYTES) { setError("That file is larger than 200 KB. Please use a smaller one."); return; }
    if ((isRead || isDocx) && file.size > 3_000_000) { setError("PDFs, Word files and pictures up to 3 MB can be read."); return; }
    setSaving(true);
    let body: string;
    try {
      if (isDocx) {
        const mammoth = await import("mammoth");
        body = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
      } else if (isRead) {
        // A PDF or a picture is read by the assistant, which answers with labelled facts.
        const buf = new Uint8Array(await file.arrayBuffer());
        let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        const r = await fetch("/api/memory/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: btoa(bin) }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { setSaving(false); setError(d.error ?? "That file could not be read."); return; }
        body = String(d.text ?? "");
      } else body = memoryFileToText(file.name, await file.text());
    } catch { setSaving(false); setError("That file could not be read."); return; }
    const res = await fetch("/api/memory/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: saveTopic, text: body }) });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Could not add that file."); return; }
    setNotice(`Added ${data.added} ${data.added === 1 ? "memory" : "memories"} from ${file.name}${data.skipped ? ` (${data.skipped} skipped, memory is full)` : ""}.`);
    setTimeout(() => setNotice(""), 4000);
    load();
  }
  async function remove(id: string) {
    setItems((l) => l?.filter((i) => i.id !== id) ?? null);
    const res = await fetch(`/api/memory/${id}`, { method: "DELETE" });
    if (!res.ok) { setError("Could not delete that."); load(); }
  }
  // A swipe up on the add bar (or its handle) shows the history; a swipe down on the sheet's handle, or a tap outside it, hides it again.
  const swipe = (onUp?: () => void, onDown?: () => void) => ({
    onTouchStart: (e: React.TouchEvent) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; },
    onTouchEnd: (e: React.TouchEvent) => {
      const a = touch.current; touch.current = null; const t = e.changedTouches[0];
      if (!a || !t) return;
      const dy = t.clientY - a.y, dx = Math.abs(t.clientX - a.x);
      if (dx < 60 && dy < -36) onUp?.(); else if (dx < 60 && dy > 36) onDown?.();
    },
  });
  const ringNodes = (ring: 0 | 1, back: boolean, seconds: number) => MEMORY_TOPICS.filter((t) => RING[t].ring === ring).map((t) => (
    <div key={t} className="mm-slot" style={{ transform: `rotate(${RING[t].angle}deg)` }}>
      <div className="mm-pt">
        <div style={{ transform: `rotate(${-RING[t].angle}deg)` }}>
          <div className={back ? "mm-cw" : "mm-ccw"} style={{ animationDuration: `${seconds}s` }}>
            <button type="button" className={`mm-node ${saveTopic === t ? "is-on" : ""}`} title={`${TOPIC_LABEL[t]} (${counts[t]})`}
              aria-label={`${TOPIC_LABEL[t]}, ${counts[t]}`} aria-pressed={saveTopic === t} onClick={() => { const next = topic === t ? "all" : t; setSaveTopic(t); setTopic(next); setOpen(next !== "all"); }}>
              {ICON[t]}{counts[t] > 0 && <i>{counts[t]}</i>}
            </button>
          </div>
        </div>
      </div>
    </div>
  ));
  return (
    <div className={`mm-wrap${shown.length ? "" : " is-empty"}`}>
      <div className="mm-top">
        <div className="mm-left">
          <Link href="/connect" className="mm-back" aria-label="Back to Core"><ChevronLeft size={24} /></Link>
          <span className="mm-title"><Brain size={18} /> Memory</span>
        </div>
        <button type="button" className="mm-import" onClick={() => setImporting(true)}><Upload size={15} /> Import</button>
      </div>

      <div className="mm-stage">
        <div className="mm-circles">
          <div className="mm-ring" />
          <div className="mm-cw mm-fill" style={{ animationDuration: `${OUTER_S}s` }}>{ringNodes(0, false, OUTER_S)}</div>
          <div className="mm-inner">
            <div className="mm-ring mm-ring-in" />
            <div className="mm-ccw mm-fill" style={{ animationDuration: `${INNER_S}s` }}>{ringNodes(1, true, INNER_S)}</div>
          </div>
          <div className="mm-core"><GlowOrb /></div>
        </div>
      </div>

      <div className="mm-copy">
        <h1>Your creative memory</h1>
        <p>{items === null ? "Loading…" : items.length === 0 ? "Nothing remembered yet" : `${items.length} thing${items.length > 1 ? "s" : ""} remembered`}</p>
      </div>

      {open && <div className="mm-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <div className={`mm-side${open ? " is-open" : ""}`}>
        <button type="button" className="mm-sheet-grab" aria-label="Hide history" onClick={() => setOpen(false)} {...swipe(undefined, () => setOpen(false))}><i /></button>
        <ConnectNav current="/memory" />
        <ul className="mm-list">
          {shown.map((i) => (
            <li key={i.id}>
              <span className="mm-tag">{TOPIC_LABEL[i.topic]}</span>
              <span className="mm-text">{i.text}</span>
              {i.source === "agent" && <small>saved by the assistant</small>}
              <button type="button" aria-label="Forget this" onClick={() => remove(i.id)}><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      </div>

      {error && <p className="mm-error" role="alert">{error}</p>}
      {notice && <p className="mm-error mm-notice" role="status">{notice}</p>}
      <button type="button" className="mm-grab" aria-label="Show history" onClick={() => setOpen((o) => !o)} {...swipe(() => setOpen(true), () => setOpen(false))}><i /></button>
      <form className="mm-add" {...swipe(() => setOpen(true))} onSubmit={(e) => { e.preventDefault(); add(); }}>
        <button type="button" className="mm-plus" aria-label="Upload a file" title="Add memories from a file: text, Word, PDF or a picture" onClick={() => fileInput.current?.click()}><Plus size={18} /></button>
        <input ref={fileInput} type="file" hidden onChange={(e) => { void uploadFile(e.target.files?.[0]); e.target.value = ""; }} />
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={MEMORY_TEXT_MAX} placeholder="Add a memory" aria-label="Add a memory" />
        <select value={saveTopic} onChange={(e) => { setSaveTopic(e.target.value as MemoryTopic); setTopic(e.target.value as MemoryTopic); }} aria-label="Topic for this memory">
          {MEMORY_TOPICS.map((t) => <option key={t} value={t}>{TOPIC_LABEL[t]}</option>)}
        </select>
        <button type="submit" className="mm-send" aria-label="Save memory" disabled={!text.trim() || saving}><ArrowUp size={18} /></button>
      </form>

      {importing && <ImportMemoryDialog onClose={() => setImporting(false)} onImported={load} />}
    </div>
  );
}
