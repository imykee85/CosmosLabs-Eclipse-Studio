"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck, ChevronLeft, Code, FileText, Inbox, LayoutGrid, List, ListChecks, Mail, MessageSquare, Plus, Search, Share2, Video,
} from "lucide-react";
import { connectorGroups, connectorWorkflows } from "@/lib/connectors";
import BrandLogo from "./brands";
import "./connect.css";

const GROUP_ICONS: Record<string, React.ReactNode> = {
  share: <Share2 size={20} />, message: <MessageSquare size={20} />, mail: <Mail size={20} />, docs: <FileText size={20} />,
  tasks: <ListChecks size={20} />, code: <Code size={20} />, video: <Video size={20} />,
};
const VIEW_KEY = "eclipse-connect-apps-view";

// A small drawn preview for a workflow card: a phone-shaped chat, or a picture with a "publishing" pill.
function FlowArt({ art, brand }: { art: "chat" | "post"; brand: string }) {
  const name = connectorGroups.flatMap((g) => g.items).find((c) => c.brand === brand)?.name ?? "";
  return (
    <div className={`cn-art cn-art-${art}`} aria-hidden="true">
      {art === "chat" ? (
        <div className="cn-phone">
          <i /><p /><p className="short" />
          <div className="cn-pic" />
          <p /><p className="short" />
        </div>
      ) : (
        <>
          <span className="cn-pill">Publishing to {name}</span>
          <div className="cn-pic" />
          <div className="cn-prompt"><p /><p className="short" /></div>
        </>
      )}
    </div>
  );
}

export default function AppsView() {
  const [tab, setTab] = useState<"explore" | "mine">("explore");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");

  useEffect(() => { try { if (localStorage.getItem(VIEW_KEY) === "grid") setView("grid"); } catch {} }, []);
  function flip() {
    const next = view === "list" ? "grid" : "list";
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch {}
  }

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return connectorGroups
      .map((g) => ({ ...g, items: g.items.filter((c) => !q || c.name.toLowerCase().includes(q) || c.blurb.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [query]);

  return (
    <div className="cn-wrap cn-connect cn-apps">
      <header className="cn-head">
        <Link href="/connect" className="cn-back" aria-label="Back to Connect"><ChevronLeft size={22} /></Link>
        <div>
          <h1>Connectors</h1>
          <p>Link the apps where you publish, store files and chat. Connections open soon.</p>
        </div>
      </header>

      <div className="cn-bar">
        <div className="cn-utabs" role="tablist" aria-label="Connected apps">
          <button type="button" role="tab" aria-selected={tab === "explore"} className={tab === "explore" ? "is-on" : ""} onClick={() => setTab("explore")}>Explore</button>
          <button type="button" role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "is-on" : ""} onClick={() => setTab("mine")}>My connectors</button>
        </div>
        {tab === "explore" && (
          <div className="cn-find">
            <label className="cn-search">
              <Search size={16} aria-hidden="true" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search connectors" />
            </label>
            <button type="button" className="cn-view" onClick={flip} aria-label={view === "list" ? "Show as grid" : "Show as list"} title={view === "list" ? "Grid view" : "List view"}>
              {view === "list" ? <LayoutGrid size={18} /> : <List size={18} />}
            </button>
          </div>
        )}
      </div>

      {tab === "mine" ? (
        <div className="cn-empty">
          <Inbox size={44} strokeWidth={1.4} aria-hidden="true" />
          <h2>Nothing connected yet</h2>
          <p>Connectors you add will appear here.</p>
          <em className="ws-soon">Connections are coming soon</em>
        </div>
      ) : (
        <>
          {!query && (
            <section aria-labelledby="cn-flows">
              <h2 id="cn-flows" className="cn-h2"><BadgeCheck size={24} className="cn-badge" /> Best workflows</h2>
              <div className="cn-flows">
                {connectorWorkflows.map((w) => (
                  <article key={w.title} className="cn-flow">
                    <FlowArt art={w.art} brand={w.brand} />
                    <div className="cn-flow-cap"><BrandLogo brand={w.brand} size={40} /><b>{w.title}</b></div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {groups.map((g) => (
            <section key={g.title} aria-label={g.title}>
              <h2 className="cn-h2">{GROUP_ICONS[g.icon]} {g.title}</h2>
              <ul className={`cn-list ${view === "grid" ? "is-grid" : ""}`}>
                {g.items.map((c) => (
                  <li key={c.name} className="cn-row">
                    <BrandLogo brand={c.brand} size={58} />
                    <span className="cn-text"><b>{c.name}</b><small>{c.blurb}</small></span>
                    <button type="button" className="cn-plus" disabled aria-label={`Connect ${c.name} (coming soon)`} title="Coming soon"><Plus size={20} /></button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {groups.length === 0 && <p className="cn-none">No connectors match “{query}”.</p>}
        </>
      )}
    </div>
  );
}
