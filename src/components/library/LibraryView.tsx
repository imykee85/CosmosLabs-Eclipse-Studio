"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FolderOpen, Search } from "lucide-react";
import { LIBRARY_KINDS, type LibraryKind } from "@/lib/library";
import "./library.css";

// Everything saved from any project, kept in one place so it can be reused in other projects.
export default function LibraryView({ kind }: { kind: LibraryKind }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  return (
    <div className="ws-ing lib">
      <h1>Library</h1>
      <p>Everything you save from your projects lives here, ready to reuse in the next one.</p>

      <div className="lib-tabs" role="tablist" aria-label="Filter by type">
        {LIBRARY_KINDS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? "is-active" : ""} onClick={() => router.replace(k === "All" ? "/library" : `/library?kind=${k}`, { scroll: false })}>{k}</button>
        ))}
      </div>

      <label className="lib-search">
        <Search size={16} aria-hidden="true" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your library..." aria-label="Search your library" />
      </label>

      <div className="lib-empty">
        <FolderOpen size={46} strokeWidth={1.4} aria-hidden="true" />
        <h2>Nothing saved yet</h2>
        <p>Items you save inside a project appear here, so you can reuse them across all your projects.</p>
        <em className="ws-soon">Saving items is coming soon</em>
      </div>
    </div>
  );
}
