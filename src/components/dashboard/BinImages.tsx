"use client";

import { useState } from "react";
import { Clock, RotateCcw, Trash2, X } from "lucide-react";
import { deleteRenderForever, restoreRender } from "@/lib/render-actions";
import { timeAgo, type Project } from "@/lib/projects";
import { useRenders } from "@/lib/use-renders";

// Images moved to the Bin from any project's Gallery or the Library. Restoring puts one back where it came from.
export default function BinImages({ projects, projectFilter, query, onClearFilter }: { projects: Project[]; projectFilter: string | null; query: string; onClearFilter: () => void }) {
  const { renders, reload } = useRenders(projectFilter ?? undefined, 100, true);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState("");
  const names = new Map(projects.map((p) => [p.id, p]));
  const q = query.trim().toLowerCase();
  const shown = (renders ?? []).filter((g) => !q || g.prompt.toLowerCase().includes(q));

  async function act(fn: () => Promise<void>) {
    setError("");
    try { await fn(); setConfirm(null); await reload(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
  }

  return (
    <>
      {projectFilter && (
        <p className="bi-filter">Showing images deleted from <b>{names.get(projectFilter)?.name ?? "this project"}</b> <button type="button" onClick={onClearFilter}><X size={13} /> Show all</button></p>
      )}
      {error && <p className="db-error" role="alert">{error}</p>}
      {renders === null ? <p className="db-loading" aria-live="polite">Loading…</p> : shown.length > 0 ? (
        <ul className="bi-grid">
          {shown.map((g) => {
            const proj = g.projectId ? names.get(g.projectId) : undefined;
            return (
              <li key={g.id} className="bi-card">
                <div className="bi-pic" style={{ aspectRatio: (g.aspectRatio ?? "1:1").replace(":", " / ") }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {g.imageUrl ? <img src={g.imageUrl} alt={g.prompt} loading="lazy" /> : <span>{g.status === "failed" ? "Failed render" : "No preview"}</span>}
                </div>
                <p className="bi-prompt" title={g.prompt}>{g.prompt}</p>
                <p className="db-meta"><Clock size={13} /> Deleted {g.deletedAt ? timeAgo(g.deletedAt) : ""}</p>
                <p className="bi-from">From {proj ? `${proj.name}${proj.deletedAt ? " (in bin)" : ""}` : "a project that no longer exists"}</p>
                <div className="db-bin-actions">
                  <button type="button" onClick={() => act(() => restoreRender(g.id))}><RotateCcw size={14} /> Restore</button>
                  {confirm === g.id ? (
                    <button type="button" className="is-danger" onClick={() => act(() => deleteRenderForever(g.id))}><Trash2 size={14} /> Yes, delete</button>
                  ) : (
                    <button type="button" className="is-danger" onClick={() => setConfirm(g.id)}><Trash2 size={14} /> Delete forever</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <section className="db-empty" aria-live="polite">
          <h1>{q ? "No matches" : "No deleted images"}</h1>
          <p>{q ? "Nothing in the bin matches your search." : "Images you delete from a Gallery or the Library show up here."}</p>
        </section>
      )}
    </>
  );
}
