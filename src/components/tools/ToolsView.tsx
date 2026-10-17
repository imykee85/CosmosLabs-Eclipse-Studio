"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownAZ, ArrowUp, ChevronLeft, ChevronRight, Film, Image as ImageIcon, Inbox, LayoutGrid, List, Plus, Search, Shapes, Type, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import ConnectNav from "@/components/connect/ConnectNav";
import { useRenders } from "@/lib/use-renders";
import { fallbackTo, thumbOf } from "@/lib/thumb-url";
import { tools, type Tool } from "@/lib/tools";
import "@/components/connect/connect.css";
import "@/components/skills/skills.css";
import "./tools.css";

const VIEW_KEY = "eclipse-tools-view";
const RECENT_KEY = "eclipse-tools-recent";
const startLink = (message: string, attach: string[] = []) => `/connect?start=${encodeURIComponent(message)}${attach.length ? `&attach=${attach.join(",")}` : ""}`;
type Tab = "explore" | "eclipse" | "mine";
const KINDS = ["Auto", "Page in the browser", "Runs on a computer"];
const INPUTS = ["Any input", "Pictures", "Text", "Videos", "Numbers or tables"];
const LOOKS = ["Any look", "Minimal", "Bold", "Playful", "Editorial"];

export default function ToolsView() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  // The three choices in the box shape the request Core receives ("Auto" leaves that part to Core).
  const [kind, setKind] = useState(KINDS[0]);
  const [input, setInput] = useState(INPUTS[0]);
  const [look, setLook] = useState(LOOKS[0]);
  const brief = (t: string) => `Build me a mini tool that does this: ${t}${kind !== KINDS[0] ? `\nKind: ${kind.toLowerCase()}.` : ""}${input !== INPUTS[0] ? `\nIt works on: ${input.toLowerCase()}.` : ""}${look !== LOOKS[0] ? `\nLook: ${look.toLowerCase()}.` : ""}`;
  // The + attaches up to 3 finished pictures from the Library; they go with the first message of the Core chat.
  const [attachOpen, setAttachOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const { renders } = useRenders(attachOpen || picked.length ? undefined : null, 16);
  const done = (renders ?? []).filter((r) => r.status === "completed" && r.kind !== "video" && r.imageUrl).slice(0, 12);
  const togglePick = (id: string) => setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : l.length < 3 ? [...l, id] : l));
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => { try { setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]")); } catch {} }, []);
  function openTool(t: Tool) {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify([t.id, ...recent.filter((x) => x !== t.id)].slice(0, 12))); } catch {}
    router.push(startLink(t.start));
  }
  const [tab, setTab] = useState<Tab>("explore");
  // Mini tools the person built with Core (private to them).
  const [built, setBuilt] = useState<{ id: string; name: string; description: string; kind: string }[]>([]);
  useEffect(() => {
    let live = true;
    fetch("/api/core/tools").then((r) => (r.ok ? r.json() : null)).then((d) => { if (live && Array.isArray(d?.tools)) setBuilt(d.tools); }).catch(() => {});
    return () => { live = false; };
  }, []);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"cards" | "list">("cards");
  const [sort, setSort] = useState<"name" | "kind">("name");

  useEffect(() => { try { if (localStorage.getItem(VIEW_KEY) === "list") setView("list"); } catch {} }, []);
  function flip() {
    const next = view === "cards" ? "list" : "cards";
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch {}
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = tools.filter((t) => !q || t.name.toLowerCase().includes(q) || t.blurb.toLowerCase().includes(q));
    return [...list].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)));
  }, [query, sort]);
  const hot = tab === "mine" ? recent.map((id) => tools.find((t) => t.id === id)).filter((t): t is Tool => Boolean(t)) : tab === "explore" && !query ? shown.slice(0, 4) : shown;

  return (
    <div className="cn-wrap cn-apps sk-wrap tl-wrap">
      <header className="cn-head">
        <Link href="/connect" className="cn-back" aria-label="Back to Core"><ChevronLeft size={22} /></Link>
        <div>
          <h1 className="pg-title">Tools</h1>
          <p>Small tools for one job each.</p>
        </div>
      </header>

      <section className="tl-hero" aria-label="Describe a tool">
        <h2><span className="tl-mark"><Wrench size={22} /></span> What do you want to build?</h2>
        <form className="tl-box" onSubmit={(e) => { e.preventDefault(); if (idea.trim()) router.push(startLink(brief(idea.trim()), picked)); }}>
          <textarea rows={2} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Describe a tool, for example: turn my product photo into a lookbook" aria-label="Describe a tool" />
          <div className="tl-row">
            <button type="button" className="tl-plus" aria-label="Attach pictures from your Library" aria-expanded={attachOpen} onClick={() => setAttachOpen((v) => !v)}><Plus size={18} />{picked.length > 0 && <i className="tl-count">{picked.length}</i>}</button>
            <label className="tl-opt"><Shapes size={15} /><span className="sr-only">Kind of tool</span>
              <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind of tool">{KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select>
            </label>
            <label className="tl-opt"><Type size={15} /><span className="sr-only">What it works on</span>
              <select value={input} onChange={(e) => setInput(e.target.value)} aria-label="What it works on">{INPUTS.map((k) => <option key={k} value={k}>{k}</option>)}</select>
            </label>
            <label className="tl-opt tl-hide"><Film size={15} /><span className="sr-only">Look</span>
              <select value={look} onChange={(e) => setLook(e.target.value)} aria-label="Look">{LOOKS.map((k) => <option key={k} value={k}>{k}</option>)}</select>
            </label>
            <button type="submit" className="tl-send" aria-label="Create" disabled={!idea.trim()}><ArrowUp size={18} /></button>
          </div>
        </form>
        {attachOpen && (
          <div className="cn-pop cn-attach tl-attach" role="dialog" aria-label="Attach pictures from your Library">
            <p className="cn-pop-note">Pick up to 3 pictures from your Library</p>
            {renders === null ? <p className="cn-pop-note">Loading…</p> : done.length === 0 ? <p className="cn-pop-note">You have no finished renders yet.</p> : (
              <div className="cn-grid">
                {done.map((r) => (
                  <button key={r.id} type="button" className={picked.includes(r.id) ? "is-on" : ""} onClick={() => togglePick(r.id)} aria-pressed={picked.includes(r.id)} title={r.prompt}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbOf("render", r.id)} onError={fallbackTo(r.imageUrl)} alt={r.prompt} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <ConnectNav current="/tools" />

      <div className="cn-bar">
        <div className="cn-utabs" role="tablist" aria-label="Tools">
          <button type="button" role="tab" aria-selected={tab === "explore"} className={tab === "explore" ? "is-on" : ""} onClick={() => setTab("explore")}>Explore</button>
          <button type="button" role="tab" aria-selected={tab === "eclipse"} className={tab === "eclipse" ? "is-on" : ""} onClick={() => setTab("eclipse")}>Eclipse tools</button>
          <button type="button" role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "is-on" : ""} onClick={() => setTab("mine")}>My tools</button>
        </div>
        {tab !== "mine" && (
          <div className="cn-find">
            <label className="cn-search">
              <Search size={16} aria-hidden="true" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search tools" />
            </label>
            <button type="button" className="cn-view" onClick={flip} aria-label={view === "cards" ? "Show as list" : "Show as cards"} title={view === "cards" ? "List view" : "Card view"}>
              {view === "cards" ? <List size={18} /> : <LayoutGrid size={18} />}
            </button>
            <button type="button" className="cn-view" onClick={() => setSort((s) => (s === "name" ? "kind" : "name"))}
              aria-label={sort === "name" ? "Sorted by name, switch to type" : "Sorted by type, switch to name"} title={sort === "name" ? "Sorted A to Z" : "Grouped by type"}>
              {sort === "name" ? <ArrowDownAZ size={18} /> : <Shapes size={18} />}
            </button>
          </div>
        )}
      </div>

      {tab === "mine" && built.length > 0 && (
        <section aria-labelledby="tl-built">
          <h2 id="tl-built" className="cn-h2"><Wrench size={22} className="cn-badge" /> Built with Core</h2>
          <ul className="tl-built">
            {built.map((t) => (
              <li key={t.id}>
                <span className="sk-ico">{t.kind === "browser" ? <LayoutGrid size={18} /> : <Wrench size={18} />}</span>
                <span className="sk-name"><b>{t.name}</b><small>{t.description}</small></span>
                <Link className="tl-open" href={`/tools/mine/${t.id}`}>Open</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "mine" && recent.length === 0 && built.length > 0 ? null : tab === "mine" && recent.length === 0 ? (
        <div className="cn-empty">
          <Inbox size={44} strokeWidth={1.4} aria-hidden="true" />
          <h2>No tools opened yet</h2>
          <p>Tools you open appear here so you can jump back in.</p>
        </div>
      ) : (
        <section aria-labelledby="tl-h">
          <div className="tl-headrow">
            <h2 id="tl-h" className="cn-h2"><LayoutGrid size={22} className="cn-badge" /> {tab === "mine" ? "Recently opened" : tab === "explore" && !query ? "Featured" : "All tools"}</h2>
            {tab === "explore" && !query && <button type="button" className="tl-all" onClick={() => setTab("eclipse")}>See all <ChevronRight size={18} /></button>}
          </div>
          <ul className={`sk-list ${view === "list" ? "is-list" : ""}`}>
            {hot.map((t) => (
              <li key={t.id} className="sk-card">
                <div className="sk-art tl-art">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.image} alt="" loading="lazy" decoding="async" />
                  <b className="tl-headline">{t.headline}</b>
                </div>
                <div className="sk-meta">
                  <span className="sk-ico">{t.kind === "Video" ? <Film size={18} /> : <ImageIcon size={18} />}</span>
                  <span className="sk-name"><b>{t.name}</b><small>{t.blurb}</small></span>
                  <button type="button" className="tl-open" onClick={() => openTool(t)}>Open</button>
                </div>
              </li>
            ))}
          </ul>
          {hot.length === 0 && <p className="cn-none">No tools match “{query}”.</p>}
        </section>
      )}
    </div>
  );
}
