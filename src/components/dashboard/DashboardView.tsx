"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, Coins, FolderOpen, GraduationCap, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { AccountName, SignOutButton } from "@/components/account";
import {
  deleteProjectForever, listProjects, restoreProject, setCurrentProject, timeAgo, trashProject, type Project,
} from "@/lib/projects";
import ThemeToggle from "@/components/ThemeToggle";
import NewProjectModal from "./NewProjectModal";
import "@/components/app-theme.css";
import "./dashboard.css";

export default function DashboardView() {
  const router = useRouter();
  const [tab, setTab] = useState<"projects" | "bin">("projects");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState("");

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

  async function act(fn: () => Promise<unknown>) {
    try { await fn(); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
  }

  function open(p: Project) {
    setCurrentProject(p);
    router.push("/project");
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
        <Link href="/" aria-label="Eclipse home" className="db-logo"><LogoMark size={48} /></Link>
        <div className="db-header-right">
          <Link href="/#how-it-works" className="db-pill"><GraduationCap size={15} /> Tutorial</Link>
          <span className="db-pill db-pill-solid" title="Credits"><Coins size={14} /> 0</span>
          <ThemeToggle className="db-icon" />
          <SignOutButton className="db-icon" />
          <AccountName>{(name) => <div className="db-user"><strong>{name}</strong><span>trial plan</span></div>}</AccountName>
        </div>
      </header>

      <main className="db-main">
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
          {newBtn()}
        </div>

        {error && <p className="db-error" role="alert">{error}</p>}

        {projects === null ? (
          <p className="db-loading" aria-live="polite">Loading your projects…</p>
        ) : shown.length > 0 ? (
          <ul className="db-grid">
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
                      <button type="button" className="db-card-btn" aria-label={`Move ${p.name} to bin`} title="Move to bin" onClick={() => act(() => trashProject(p.id))}>
                        <Trash2 size={16} />
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
                  <h1>No matches</h1>
                  <p>No project is called &ldquo;{query.trim()}&rdquo;.</p>
                </>
              ) : (
                <>
                  <button type="button" className="db-empty-plus" aria-label="New project" onClick={() => setCreating(true)}><Plus size={22} /></button>
                  <h1>No projects yet</h1>
                  <p>Create your first project to get started.</p>
                  {newBtn()}
                </>
              )
            ) : (
              <>
                <h1>{query.trim() ? "No matches" : "Bin is empty"}</h1>
                <p>{query.trim() ? "Nothing in the bin matches your search." : "Deleted projects will show up here."}</p>
              </>
            )}
          </section>
        )}
      </main>
      {creating && <NewProjectModal onClose={() => setCreating(false)} />}
    </div>
  );
}
