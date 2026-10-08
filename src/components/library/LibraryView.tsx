"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FolderOpen, Search } from "lucide-react";
import { INGREDIENT_ROLES, LIBRARY_KINDS, type LibraryKind } from "@/lib/library";
import { useRenders } from "@/lib/use-renders";
import RenderTile from "./RenderTile";
import "./library.css";

// Everything saved from any project, kept in one place so it can be reused in other projects.
export default function LibraryView({ kind }: { kind: LibraryKind }) {
  const router = useRouter();
  const { renders: all } = useRenders();
  const renders = all ?? [];
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<(typeof INGREDIENT_ROLES)[number]>("All");

  const q = query.trim().toLowerCase();
  const shown = renders.filter((g) => !q || g.prompt.toLowerCase().includes(q));

  return (
    <div className="ws-ing lib">
      <h1>Library</h1>
      <p>Everything you save from your projects lives here, ready to reuse in the next one.</p>

      <div className="lib-tabs" role="tablist" aria-label="Filter by type">
        {LIBRARY_KINDS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? "is-active" : ""} onClick={() => router.replace(k === "All" ? "/library" : `/library?kind=${k}`, { scroll: false })}>{k}</button>
        ))}
      </div>

      {kind === "Ingredients" && (
        <div className="lib-roles" role="group" aria-label="Ingredient type">
          {INGREDIENT_ROLES.map((r) => (
            <button key={r} type="button" aria-pressed={role === r} className={role === r ? "is-active" : ""} onClick={() => setRole(r)}>{r === "All" ? "All ingredients" : `${r}s`}</button>
          ))}
        </div>
      )}

      <label className="lib-search">
        <Search size={16} aria-hidden="true" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your library..." aria-label="Search your library" />
      </label>

      {(kind === "All" || kind === "Images") && shown.length > 0 ? (
        <div className="lib-grid">
          {shown.map((g) => (
            <RenderTile key={g.id} g={g} />
          ))}
        </div>
      ) : (
      <div className="lib-empty">
        <FolderOpen size={46} strokeWidth={1.4} aria-hidden="true" />
        <h2>Nothing saved yet</h2>
        <p>Items you save inside a project appear here, so you can reuse them across all your projects.</p>
      </div>
      )}
    </div>
  );
}
