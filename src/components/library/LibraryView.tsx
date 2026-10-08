"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FolderOpen, Search } from "lucide-react";
import { INGREDIENT_ROLES, LIBRARY_KINDS, type LibraryKind } from "@/lib/library";
import "./library.css";

// Everything saved from any project, kept in one place so it can be reused in other projects.
type Render = { id: string; prompt: string; imageUrl: string };

export default function LibraryView({ kind }: { kind: LibraryKind }) {
  const router = useRouter();
  const [renders, setRenders] = useState<Render[]>([]);

  // Your finished renders come from the server with fresh short-lived links; in preview mode (no sign-in) the list stays empty.
  useEffect(() => {
    let live = true;
    fetch("/api/generations?limit=100")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => { if (live && Array.isArray(d.items)) setRenders(d.items); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
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
            // eslint-disable-next-line @next/next/no-img-element
            <a key={g.id} className="lib-tile" href={g.imageUrl} target="_blank" rel="noreferrer"><img src={g.imageUrl} alt={g.prompt} loading="lazy" /><span>{g.prompt}</span></a>
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
