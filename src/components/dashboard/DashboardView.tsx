"use client";

import Link from "next/link";
import { useState } from "react";
import { Coins, FolderOpen, GraduationCap, Plus, Search, Trash2 } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { AccountName, SignOutButton } from "@/components/account";
import NewProjectModal from "./NewProjectModal";
import "./dashboard.css";

export default function DashboardView() {
  const [tab, setTab] = useState<"projects" | "bin">("projects");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  return (
    <div className="db-page">
      <header className="db-header">
        <Link href="/" aria-label="Eclipse home" className="db-logo"><LogoMark size={48} /></Link>
        <div className="db-header-right">
          <Link href="/#how-it-works" className="db-pill"><GraduationCap size={15} /> Tutorial</Link>
          <span className="db-pill db-pill-solid" title="Credits"><Coins size={14} /> 0</span>
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
          <button type="button" className="db-new" onClick={() => setCreating(true)}><Plus size={16} /> New Project</button>
        </div>

        <section className="db-empty" aria-live="polite">
          <button type="button" className="db-empty-plus" aria-label="New project" onClick={() => setCreating(true)}><Plus size={22} /></button>
          {tab === "projects" ? (
            <>
              <h1>No projects yet</h1>
              <p>Create your first project to get started.</p>
              <button type="button" className="db-new" onClick={() => setCreating(true)}><Plus size={16} /> New Project</button>
            </>
          ) : (
            <>
              <h1>Bin is empty</h1>
              <p>Deleted projects will show up here.</p>
            </>
          )}
        </section>
      </main>
      {creating && <NewProjectModal onClose={() => setCreating(false)} />}
    </div>
  );
}
