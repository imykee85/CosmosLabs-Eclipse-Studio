"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FolderOpen, Search } from "lucide-react";
import { INGREDIENT_ROLES, LIBRARY_KINDS, type LibraryKind } from "@/lib/library";
import { useRenders } from "@/lib/use-renders";
import UploadPanel from "@/components/uploads/UploadPanel";
import LibraryAudio from "./LibraryAudio";
import MoreSentinel from "./MoreSentinel";
import RenderTile from "./RenderTile";
import "./library.css";

const PAGE = 30; // the first screenful opens fast; more load as you scroll

// Everything saved from any project, kept in one place so it can be reused in other projects.
export default function LibraryView({ kind }: { kind: LibraryKind }) {
  const router = useRouter();
  const [limit, setLimit] = useState(PAGE);
  const { renders: all, reload } = useRenders(undefined, limit);
  const more = useCallback(() => setLimit((l) => l + PAGE), []);
  const renders = all ?? [];
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<(typeof INGREDIENT_ROLES)[number]>("All");

  const q = query.trim().toLowerCase();
  useEffect(() => { if (q) setLimit(100); }, [q]); // a search looks through everything, not just the pages loaded so far
  const shown = renders.filter((g) => (!q || g.prompt.toLowerCase().includes(q)) && (kind === "Videos" ? g.kind === "video" : kind === "Images" ? g.kind !== "video" : true));

  return (
    <div className="ws-ing lib">
      <h1 className="pg-title">Library</h1>
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

      {kind === "Ingredients" ? (
        <UploadPanel show="ingredients" addKinds={["character", "product", "scene"]} addLabel="Add ingredient" role={role === "All" ? "all" : (role.toLowerCase() as "character" | "product" | "scene")} empty={{ title: "No ingredients yet", copy: "Characters, products and scenes you add appear here, ready to reuse in any project." }} />
      ) : kind === "Audio" ? (
        <LibraryAudio query={query} />
      ) : (kind === "All" || kind === "Images" || kind === "Videos") && shown.length > 0 ? (
        <>
          <div className="lib-grid">
            {shown.map((g) => (
              <RenderTile key={g.id} g={g} onChanged={reload} />
            ))}
          </div>
          <MoreSentinel active={renders.length >= limit && limit < 100} onMore={more} />
        </>
      ) : (
      <div className="lib-empty">
        <FolderOpen size={46} strokeWidth={1.4} aria-hidden="true" />
        <h2>{kind === "Videos" ? "No videos yet" : "Nothing saved yet"}</h2>
        <p>{kind === "Videos" ? "Videos you make in Video Studio appear here, ready to open in any project." : "Items you save inside a project appear here, so you can reuse them across all your projects."}</p>
      </div>
      )}
    </div>
  );
}
