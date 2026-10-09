"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownAZ, BadgeCheck, ChevronLeft, Clock, LayoutGrid, List, Play, Plus, Puzzle, Search, Timer, Trash2, X } from "lucide-react";
import ConnectNav from "@/components/connect/ConnectNav";
import { skills } from "@/lib/skills";
import "@/components/connect/connect.css";
import "./skills.css";

const VIEW_KEY = "eclipse-skills-view";
type Sort = "name" | "time";
type Own = { id: string; name: string; blurb: string; instructions: string };
// Running a skill opens a Connect chat that starts with it; the assistant fetches the playbook itself.
const runLink = (name: string, id: string) => `/connect?start=${encodeURIComponent(`Use the skill "${name}" (id: ${id}). Ask me only what you need to begin.`)}`;

export default function SkillsView() {
  const [tab, setTab] = useState<"explore" | "mine">("explore");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"cards" | "list">("cards");
  const [sort, setSort] = useState<Sort>("name");
  const [own, setOwn] = useState<Own[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", blurb: "", instructions: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/user-skills", { cache: "no-store" }).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (r.ok) setOwn(d.items); else { setOwn([]); if (r.status === 503) setError("Sign in to save skills of your own."); }
    }).catch(() => setOwn([]));
  }, []);

  async function create() {
    setSaving(true); setError("");
    const res = await fetch("/api/user-skills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(d.error ?? "Could not save the skill."); return; }
    setOwn((l) => [d, ...(l ?? [])]); setCreating(false); setForm({ name: "", blurb: "", instructions: "" }); setTab("mine");
  }
  async function remove(id: string) {
    setOwn((l) => l?.filter((s) => s.id !== id) ?? null);
    await fetch(`/api/user-skills/${id}`, { method: "DELETE" });
  }

  useEffect(() => { try { if (localStorage.getItem(VIEW_KEY) === "list") setView("list"); } catch {} }, []);
  function flip() {
    const next = view === "cards" ? "list" : "cards";
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch {}
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = skills.filter((s) => !q || s.name.toLowerCase().includes(q) || s.blurb.toLowerCase().includes(q));
    return [...list].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : a.minutes - b.minutes));
  }, [query, sort]);

  return (
    <div className="cn-wrap cn-apps sk-wrap">
      <header className="cn-head">
        <Link href="/connect" className="cn-back" aria-label="Back to Connect"><ChevronLeft size={22} /></Link>
        <div>
          <h1>Skills</h1>
          <p>Ready-made recipes your agents can run for you.</p>
        </div>
      </header>

      <ConnectNav current="/skills" />

      <div className="cn-bar">
        <div className="cn-utabs" role="tablist" aria-label="Skills">
          <button type="button" role="tab" aria-selected={tab === "explore"} className={tab === "explore" ? "is-on" : ""} onClick={() => setTab("explore")}>Explore</button>
          <button type="button" role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "is-on" : ""} onClick={() => setTab("mine")}>My skills</button>
        </div>
        {tab === "explore" && (
          <div className="cn-find">
            <label className="cn-search">
              <Search size={16} aria-hidden="true" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search skills" />
            </label>
            <button type="button" className="cn-view" onClick={flip} aria-label={view === "cards" ? "Show as list" : "Show as cards"} title={view === "cards" ? "List view" : "Card view"}>
              {view === "cards" ? <List size={18} /> : <LayoutGrid size={18} />}
            </button>
            <button type="button" className="cn-view" onClick={() => setSort((s) => (s === "name" ? "time" : "name"))}
              aria-label={sort === "name" ? "Sorted by name, switch to quickest first" : "Sorted by time, switch to name"} title={sort === "name" ? "Sorted A to Z" : "Quickest first"}>
              {sort === "name" ? <ArrowDownAZ size={18} /> : <Timer size={18} />}
            </button>
          </div>
        )}
      </div>

      {tab === "mine" ? (
        <section aria-label="My skills">
          <div className="sk-mine-head">
            <button type="button" className="cn-btn is-red" onClick={() => { setCreating(true); setError(""); }}><Plus size={16} /> New skill</button>
          </div>
          {error && !creating && <p className="cn-err" role="alert">{error}</p>}
          {own && own.length === 0 ? (
            <div className="cn-empty">
              <Puzzle size={44} strokeWidth={1.4} aria-hidden="true" />
              <h2>No skills of your own yet</h2>
              <p>Write the steps you want the assistant to follow, then run them whenever you like.</p>
            </div>
          ) : (
            <ul className="sk-own">
              {(own ?? []).map((s) => (
                <li key={s.id}>
                  <span className="sk-ico"><Puzzle size={18} /></span>
                  <span className="sk-name"><b>{s.name}</b><small>{s.blurb || s.instructions.slice(0, 90)}</small></span>
                  <Link href={runLink(s.name, s.id)} className="cn-btn"><Play size={14} /> Run</Link>
                  <button type="button" className="cn-pop-del" aria-label={`Delete ${s.name}`} onClick={() => remove(s.id)}><Trash2 size={16} /></button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section aria-labelledby="sk-by">
          <h2 id="sk-by" className="cn-h2"><BadgeCheck size={24} className="cn-badge" /> Skills by Eclipse</h2>
          <ul className={`sk-list ${view === "list" ? "is-list" : ""}`}>
            {shown.map((s) => (
              <li key={s.id} className="sk-card">
                <div className="sk-art">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.image} alt="" loading="lazy" decoding="async" />
                </div>
                <div className="sk-meta">
                  <span className="sk-ico"><Puzzle size={18} /></span>
                  <span className="sk-name"><b>{s.name}</b><small>{s.blurb}</small></span>
                  <span className="sk-tags"><span><Clock size={15} /> {s.minutes} min</span><span><Puzzle size={15} /> Skill</span></span>
                  <Link href={runLink(s.name, s.id)} className="tl-open"><Play size={14} /> Run</Link>
                </div>
              </li>
            ))}
          </ul>
          {shown.length === 0 && <p className="cn-none">No skills match “{query}”.</p>}
        </section>
      )}

      {creating && (
        <div className="cn-modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && setCreating(false)}>
          <div className="cn-modal" role="dialog" aria-label="New skill">
            <h2>New skill</h2>
            <p>Describe the job and the steps. The assistant follows them when you run the skill.</p>
            <label className="cn-field">Name<input value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Weekly product drop" /></label>
            <label className="cn-field">Short description<input value={form.blurb} maxLength={160} onChange={(e) => setForm({ ...form, blurb: e.target.value })} placeholder="Three launch visuals for a new product" /></label>
            <label className="cn-field">Steps<textarea rows={7} value={form.instructions} maxLength={4000} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder={"1. Ask for the product and its price.\n2. Write three prompts: hero, detail, lifestyle.\n3. Render each at 4:5."} /></label>
            {error && <p className="cn-err" role="alert">{error}</p>}
            <div className="cn-actions">
              <button type="button" className="cn-btn" onClick={() => setCreating(false)}><X size={14} /> Cancel</button>
              <button type="button" className="cn-btn is-red" disabled={saving || !form.name.trim() || form.instructions.trim().length < 10} onClick={create}>Save skill</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
