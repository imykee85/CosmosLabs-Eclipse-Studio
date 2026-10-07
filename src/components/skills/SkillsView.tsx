"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownAZ, BadgeCheck, ChevronLeft, Clock, Film, Image as ImageIcon, Inbox, LayoutGrid, List, Search, Timer, Zap } from "lucide-react";
import { skills } from "@/lib/skills";
import "@/components/connect/connect.css";
import "./skills.css";

const VIEW_KEY = "eclipse-skills-view";
type Sort = "name" | "time";

export default function SkillsView() {
  const [tab, setTab] = useState<"explore" | "mine">("explore");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"cards" | "list">("cards");
  const [sort, setSort] = useState<Sort>("name");

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
          <p>Ready-made recipes your agents can run for you. Skills open soon.</p>
        </div>
      </header>

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
        <div className="cn-empty">
          <Inbox size={44} strokeWidth={1.4} aria-hidden="true" />
          <h2>No skills of your own yet</h2>
          <p>Skills you save or create will appear here.</p>
          <em className="ws-soon">Coming soon</em>
        </div>
      ) : (
        <section aria-labelledby="sk-by">
          <h2 id="sk-by" className="cn-h2"><BadgeCheck size={24} className="cn-badge" /> Skills by Eclipse</h2>
          <ul className={`sk-list ${view === "list" ? "is-list" : ""}`}>
            {shown.map((s) => (
              <li key={s.id} className="sk-card">
                <div className="sk-art">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.image} alt="" loading="lazy" decoding="async" />
                  <em className="ws-soon">Soon</em>
                </div>
                <div className="sk-meta">
                  <span className="sk-ico">{s.kind === "video" ? <Film size={18} /> : <ImageIcon size={18} />}</span>
                  <span className="sk-name"><b>{s.name}</b><small>{s.blurb}</small></span>
                  <span className="sk-tags"><span><Clock size={15} /> {s.minutes} min</span><span><Zap size={15} /> Skill</span></span>
                </div>
              </li>
            ))}
          </ul>
          {shown.length === 0 && <p className="cn-none">No skills match “{query}”.</p>}
        </section>
      )}
    </div>
  );
}
