"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, FolderOpen, Info, LayoutGrid, Rows3, MoreHorizontal, Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { rememberPage } from "@/lib/last-page";
import NotificationsButton from "@/components/Notifications";
import UserMenu from "@/components/UserMenu";
import {
  deleteProjectForever, listProjects, restoreProject, setCurrentProject, timeAgo, trashProject, type Project,
} from "@/lib/projects";
import ThemeToggle from "@/components/ThemeToggle";
import CreditsPill from "@/components/CreditsPill";
import NewProjectModal from "./NewProjectModal";
import BinImages from "./BinImages";
import HomeFeed from "./HomeFeed";
import ProjectDetailsModal from "./ProjectDetailsModal";
import RenameProjectModal from "./RenameProjectModal";
import "@/components/app-theme.css";
import "./dashboard.css";

export default function DashboardView() {
  const router = useRouter();
  const [tab, setTab] = useState<"projects" | "bin">("projects");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState("");
  const [binSection, setBinSection] = useState<"projects" | "images">("projects");
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ project: Project; top: number; right: number } | null>(null);
  const [renaming, setRenaming] = useState<Project | null>(null);
  const [details, setDetails] = useState<Project | null>(null);
  // Compact grid is the default so the home feed below comes up into view; "large" is the roomy card layout.
  const [view, setView] = useState<"grid" | "large">("grid");
  useEffect(() => { try { if (localStorage.getItem("eclipse-dashboard-view") === "large") setView("large"); } catch {} }, []);
  function pickView(v: "grid" | "large") { setView(v); try { localStorage.setItem("eclipse-dashboard-view", v); } catch {} }

  // A Gallery's "Recently deleted" link arrives as /dashboard?bin=images&project=<id>.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("bin")) { setTab("bin"); setBinSection(q.get("bin") === "images" ? "images" : "projects"); setProjectFilter(q.get("project")); }
  }, []);

  // Close the project menu on Escape, on a click elsewhere, or when the page moves under it.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [menu]);

  const load = useCallback(async () => {
    try {
      setProjects(await listProjects());
      setError("");
    } catch (e) {
      setProjects([]);
      setError(e instanceof Error ? e.message : "Could not load your projects.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { rememberPage("/dashboard"); }, []);

  async function act(fn: () => Promise<unknown>) {
    try { await fn(); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
  }

  function open(p: Project) {
    setCurrentProject(p);
    router.push("/project");
  }

  // Home cards open a page inside the latest project, or ask for a new project when there is none yet.
  function goTo(path: string) {
    const latest = (projects ?? []).filter((p) => !p.deletedAt).sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))[0];
    if (!latest) { setCreating(true); return; }
    setCurrentProject(latest);
    router.push(path);
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (projects ?? [])
      .filter((p) => (tab === "bin" ? p.deletedAt : !p.deletedAt))
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => +new Date(b.deletedAt ?? b.updatedAt) - +new Date(a.deletedAt ?? a.updatedAt));
  }, [projects, tab, query]);

  const newBtn = (cls = "db-new") => (
    <button type="button" className={cls} onClick={() => setCreating(true)}><Plus size={16} /> New Project</button>
  );

  return (
    <div className="db-page">
      <header className="db-header">
        <div className="db-left"><span className="db-logo"><LogoMark size={48} /></span><h1 className="db-title">Dashboard</h1></div>
        <div className="db-header-right">
          <CreditsPill className="db-pill db-pill-solid db-credits" />
          <ThemeToggle className="db-icon" />
          <NotificationsButton className="db-icon" />
          <UserMenu />
        </div>
      </header>

      <main className="db-main">
        <div className="db-top">
        <div className="db-toolbar">
          <div className="db-tabs" role="tablist" aria-label="Project views">
            <button role="tab" aria-selected={tab === "projects"} className={tab === "projects" ? "is-active" : ""} onClick={() => setTab("projects")}>
              <FolderOpen size={15} /> Projects
            </button>
            <button role="tab" aria-selected={tab === "bin"} className={tab === "bin" ? "is-active" : ""} onClick={() => setTab("bin")}>
              <Trash2 size={15} /> Bin
            </button>
          </div>
          <label className="db-search">
            <Search size={16} />
            <input type="search" placeholder="Search projects…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search projects" />
          </label>
          <button type="button" className="db-view" aria-label={view === "grid" ? "Show large project cards" : "Show compact project grid"} title={view === "grid" ? "Large cards" : "Compact grid"}
            onClick={() => pickView(view === "grid" ? "large" : "grid")}>
            {view === "grid" ? <Rows3 size={18} /> : <LayoutGrid size={18} />}
          </button>
          {newBtn()}
        </div>

        {error && <p className="db-error" role="alert">{error}</p>}

        {tab === "bin" && (
          <div className="db-subtabs" role="tablist" aria-label="Bin sections">
            <button role="tab" aria-selected={binSection === "projects"} className={binSection === "projects" ? "is-active" : ""} onClick={() => setBinSection("projects")}>Projects</button>
            <button role="tab" aria-selected={binSection === "images"} className={binSection === "images" ? "is-active" : ""} onClick={() => setBinSection("images")}>Images</button>
          </div>
        )}

        {tab === "bin" && binSection === "images" ? (
          <BinImages projects={projects ?? []} projectFilter={projectFilter} query={query} onClearFilter={() => setProjectFilter(null)} />
        ) : projects === null ? (
          <p className="db-loading" aria-live="polite">Loading your projects…</p>
        ) : shown.length > 0 ? (
          <ul className={`db-grid ${view === "grid" ? "is-compact" : ""}`}>
            {shown.map((p) => (
              <li key={p.id} className={`db-card ${tab === "bin" ? "is-bin" : ""}`}>
                <div className="db-thumb">
                  <span className="db-badge">{tab === "bin" ? "In bin" : "Draft"}</span>
                  <b aria-hidden="true">{p.name.trim().slice(0, 3).toLowerCase()}</b>
                </div>
                <div className="db-card-body">
                  <div className="db-card-row">
                    {tab === "bin" ? (
                      <h2>{p.name}</h2>
                    ) : (
                      <h2><button type="button" className="db-open" onClick={() => open(p)}>{p.name}</button></h2>
                    )}
                    {tab === "projects" && (
                      <button type="button" className="db-card-btn" aria-label={`More options for ${p.name}`} aria-haspopup="menu" aria-expanded={menu?.project.id === p.id} title="More"
                        onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setMenu(menu?.project.id === p.id ? null : { project: p, top: r.bottom + 6, right: window.innerWidth - r.right }); }}>
                        <MoreHorizontal size={18} />
                      </button>
                    )}
                  </div>
                  {tab === "bin" && (
                    <div className="db-bin-actions">
                      <button type="button" onClick={() => act(() => restoreProject(p.id))}><RotateCcw size={14} /> Restore</button>
                      <button type="button" className="is-danger" onClick={() => act(() => deleteProjectForever(p.id))}><Trash2 size={14} /> Delete forever</button>
                    </div>
                  )}
                  <p className="db-meta"><Clock size={13} /> {tab === "bin" ? `Deleted ${timeAgo(p.deletedAt!)}` : `Last edited ${timeAgo(p.updatedAt)}`}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <section className="db-empty" aria-live="polite">
            {tab === "projects" ? (
              query.trim() ? (
                <>
                  <h2>No matches</h2>
                  <p>No project is called &ldquo;{query.trim()}&rdquo;.</p>
                </>
              ) : (
                <>
                  <button type="button" className="db-empty-plus" aria-label="New project" onClick={() => setCreating(true)}><Plus size={22} /></button>
                  <h2>No projects yet</h2>
                  <p>Create your first project to get started.</p>
                  {newBtn()}
                </>
              )
            ) : (
              <>
                <h2>{query.trim() ? "No matches" : "Bin is empty"}</h2>
                <p>{query.trim() ? "Nothing in the bin matches your search." : "Deleted projects will show up here."}</p>
              </>
            )}
          </section>
        )}
        </div>
        {tab === "projects" && projects !== null && !query.trim() && <HomeFeed onGo={goTo} />}
      </main>
      {menu && (
        <>
          <div className="pm-scrim" onMouseDown={() => setMenu(null)} />
          <div className="pm-menu" role="menu" style={{ top: menu.top, right: menu.right }}>
            <button type="button" role="menuitem" onClick={() => { setRenaming(menu.project); setMenu(null); }}><Pencil size={15} /> Rename</button>
            <button type="button" role="menuitem" onClick={() => { setDetails(menu.project); setMenu(null); }}><Info size={15} /> Project details</button>
            <button type="button" role="menuitem" className="is-danger" onClick={() => { const p = menu.project; setMenu(null); act(() => trashProject(p.id)); }}><Trash2 size={15} /> Move to bin</button>
          </div>
        </>
      )}
      {renaming && <RenameProjectModal project={renaming} onClose={() => setRenaming(null)} onDone={load} />}
      {details && <ProjectDetailsModal project={details} onClose={() => setDetails(null)} />}
      {creating && <NewProjectModal onClose={() => setCreating(false)} />}
    </div>
  );
}
