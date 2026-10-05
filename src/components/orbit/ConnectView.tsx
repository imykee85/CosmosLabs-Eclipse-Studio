"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronLeft, Cloud, Gamepad2, Hash, Inbox, Megaphone, MessageCircle, Music2, NotebookPen, Plus, Search, Send, Share2, ChartColumn, FolderOpen,
} from "lucide-react";
import { connectorGroups, connectorWorkflows } from "@/lib/connectors";
import "./orbit.css";

const ICONS: Record<string, React.ReactNode> = {
  megaphone: <Megaphone size={18} />, chart: <ChartColumn size={18} />, folder: <FolderOpen size={18} />, message: <MessageCircle size={18} />,
  music: <Music2 size={20} />, share: <Share2 size={20} />, cloud: <Cloud size={20} />, notes: <NotebookPen size={20} />,
  send: <Send size={20} />, hash: <Hash size={20} />, game: <Gamepad2 size={20} />,
};

export default function ConnectView() {
  const [tab, setTab] = useState<"explore" | "mine">("explore");
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return connectorGroups
      .map((g) => ({ ...g, items: g.items.filter((c) => !q || c.name.toLowerCase().includes(q) || c.blurb.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [query]);

  return (
    <div className="or-wrap or-connect">
      <header className="or-head">
        <Link href="/orbit" className="or-back" aria-label="Back to Orbit"><ChevronLeft size={22} /></Link>
        <div>
          <h1>Connect apps</h1>
          <p>Link the places you publish, store files and chat. Connections open soon.</p>
        </div>
      </header>

      <div className="or-tabs" role="tablist" aria-label="Connected apps">
        <button type="button" role="tab" aria-selected={tab === "explore"} className={tab === "explore" ? "is-on" : ""} onClick={() => setTab("explore")}>Explore</button>
        <button type="button" role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "is-on" : ""} onClick={() => setTab("mine")}>My apps</button>
      </div>

      {tab === "mine" ? (
        <div className="or-empty">
          <Inbox size={44} strokeWidth={1.4} aria-hidden="true" />
          <h2>No apps connected yet</h2>
          <p>Apps you connect will appear here.</p>
          <em className="ws-soon">Connections are coming soon</em>
        </div>
      ) : (
        <>
          <label className="or-search">
            <Search size={16} aria-hidden="true" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search apps..." aria-label="Search apps" />
          </label>

          {!query && (
            <section aria-labelledby="or-flows">
              <h2 id="or-flows" className="or-h2">Workflows to look forward to</h2>
              <div className="or-flows">
                {connectorWorkflows.map((w, i) => (
                  <article key={w.title} className={`or-flow tone-${i}`}>
                    <b>{w.title}</b><span>{w.sub}</span>
                  </article>
                ))}
              </div>
            </section>
          )}

          {groups.map((g) => (
            <section key={g.title} aria-label={g.title}>
              <h2 className="or-h2">{ICONS[g.icon]} {g.title}</h2>
              <ul className="or-list">
                {g.items.map((c) => (
                  <li key={c.name} className="or-row">
                    <span className="or-logo">{ICONS[c.icon]}</span>
                    <span className="or-text"><b>{c.name}</b><small>{c.blurb}</small></span>
                    <button type="button" className="or-plus" disabled aria-label={`Connect ${c.name} (coming soon)`} title="Coming soon"><Plus size={18} /></button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {groups.length === 0 && <p className="or-none">No apps match “{query}”.</p>}
        </>
      )}
    </div>
  );
}
