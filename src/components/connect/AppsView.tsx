"use client";

import SoonTag from "@/components/SoonTag";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck, Check, ChevronLeft, Code, FileText, Inbox, LayoutGrid, List, ListChecks, Mail, MessageSquare, Plus, Search, Share2, Video, X,
} from "lucide-react";
import ConnectNav from "./ConnectNav";
import { connectorGroups, connectorId, connectorWorkflows, directConnectors, type Connector } from "@/lib/connectors";
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
  const [linked, setLinked] = useState<Record<string, string>>({});
  const [target, setTarget] = useState<Connector | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/connectors", { cache: "no-store" }).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (r.ok) setLinked(Object.fromEntries((d.items as { id: string; label: string }[]).map((i) => [i.id, i.label])));
    }).catch(() => {});
  }, []);

  function begin(c: Connector) { setTarget(c); setValues({}); setError(""); }
  async function connect() {
    if (!target) return;
    setBusy(true); setError("");
    const id = connectorId(target);
    const res = await fetch(`/api/connectors/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(res.status === 503 ? "Sign in to connect apps." : d.error ?? "Could not connect."); return; }
    setLinked((l) => ({ ...l, [id]: d.label }));
    setTarget(null);
  }
  async function disconnect(c: Connector) {
    const id = connectorId(c);
    setLinked((l) => { const n = { ...l }; delete n[id]; return n; });
    await fetch(`/api/connectors/${id}`, { method: "DELETE" });
  }
  const spec = target ? directConnectors[connectorId(target)] : undefined;
  const mine = connectorGroups.flatMap((g) => g.items).filter((c) => linked[connectorId(c)] !== undefined);

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
          <h1 className="pg-title">Connectors</h1>
          <p>Link the apps where you publish, store files and chat.</p>
        </div>
      </header>

      <ConnectNav current="/connect/apps" />

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
        mine.length === 0 ? (
          <div className="cn-empty">
            <Inbox size={44} strokeWidth={1.4} aria-hidden="true" />
            <h2>Nothing connected yet</h2>
            <p>Connectors you add will appear here.</p>
          </div>
        ) : (
          <ul className="cn-list" style={{ marginTop: 18 }}>
            {mine.map((c) => (
              <li key={c.name} className="cn-row">
                <BrandLogo brand={c.brand} size={58} />
                <span className="cn-text"><b>{c.name}</b><small>{linked[connectorId(c)]}</small></span>
                <button type="button" className="cn-btn" onClick={() => disconnect(c)}>Disconnect</button>
              </li>
            ))}
          </ul>
        )
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
                    {linked[connectorId(c)] !== undefined
                      ? <button type="button" className="cn-plus is-on" aria-label={`${c.name} is connected. Disconnect`} title="Connected. Click to disconnect" onClick={() => disconnect(c)}><Check size={20} /></button>
                      : directConnectors[connectorId(c)]
                        ? <button type="button" className="cn-plus" aria-label={`Connect ${c.name}`} onClick={() => begin(c)}><Plus size={20} /></button>
                        : <SoonTag className="cn-soon" />}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {groups.length === 0 && <p className="cn-none">No connectors match “{query}”.</p>}
        </>
      )}

      {target && (
        <div className="cn-modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && setTarget(null)}>
          <form className="cn-modal" role="dialog" aria-label={`Connect ${target.name}`} onSubmit={(e) => { e.preventDefault(); connect(); }}>
            <h2>Connect {target.name}</h2>
            {spec ? (
              <>
                <p>{spec.help} We send a test message first, and keep the credential encrypted.</p>
                {spec.fields.map((f) => (
                  <label key={f.key} className="cn-field">{f.label}
                    <input type={f.secret ? "password" : "text"} autoComplete="off" value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} placeholder={f.hint} />
                  </label>
                ))}
              </>
            ) : <p>{target.name} connects through a sign-in the service has to approve. Press Connect to start it.</p>}
            {error && <p className="cn-err" role="alert">{error}</p>}
            <div className="cn-actions">
              <button type="button" className="cn-btn" onClick={() => setTarget(null)}><X size={14} /> Cancel</button>
              <button type="submit" className="cn-btn is-red" disabled={busy || (spec ? spec.fields.some((f) => !(values[f.key] ?? "").trim()) : false)}>{busy ? "Connecting…" : "Connect"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
