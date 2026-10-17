"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Download, Link2, Share2 } from "lucide-react";
import { readCurrentProject } from "@/lib/projects";
import { useRenders } from "@/lib/use-renders";
import MoreSentinel from "./MoreSentinel";
import "./library.css";

const PAGE = 30;

// The last step: pick finished work from this project and take it with you, as downloads or as 7-day share links.
export default function ExportView() {
  const [projectId, setProjectId] = useState<string | null | undefined>(undefined);
  useEffect(() => { setProjectId(readCurrentProject()?.id ?? null); }, []);
  const [limit, setLimit] = useState(PAGE);
  const { renders } = useRenders(projectId === undefined ? null : projectId, limit);
  const more = useCallback(() => setLimit((l) => l + PAGE), []);
  const done = (renders ?? []).filter((g) => g.status === "completed" && g.imageUrl);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const chosen = done.filter((g) => picked.has(g.id));

  async function download() {
    setBusy(true); setNote("");
    for (const g of chosen) {
      const a = document.createElement("a");
      a.href = `/api/generations/${g.id}/file?download=1`;
      a.download = g.fileName ?? "";
      document.body.appendChild(a); a.click(); a.remove();
      await new Promise((r) => setTimeout(r, 500)); // browsers drop downloads fired in the same instant
    }
    setBusy(false);
  }
  async function copyLinks() {
    setBusy(true); setNote("");
    try {
      const urls: string[] = [];
      for (const g of chosen) {
        const r = await fetch(`/api/generations/${g.id}/share`, { method: "POST" });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || typeof d.url !== "string") throw new Error();
        urls.push(d.url);
      }
      await navigator.clipboard.writeText(urls.join("\n"));
      setNote(`Copied ${urls.length} link${urls.length === 1 ? "" : "s"}. They work for 7 days.`);
    } catch { setNote("Could not make the links. Please try again."); }
    setBusy(false);
  }

  return (
    <div className="ws-ing lib">
      <h1 className="pg-title">Export</h1>
      <p>Choose finished work from this project to download or share.</p>
      {done.length > 0 ? (<>
        <div className="ex-bar">
          <button type="button" className="ex-btn" onClick={() => setPicked(new Set(done.map((g) => g.id)))}>Select all</button>
          <button type="button" className="ex-btn" onClick={() => setPicked(new Set())} disabled={!picked.size}>Clear</button>
          <span className="ex-count">{picked.size} selected</span>
          <button type="button" className="ex-btn ex-main" onClick={download} disabled={!picked.size || busy}><Download size={15} /> Download</button>
          <button type="button" className="ex-btn" onClick={copyLinks} disabled={!picked.size || busy}><Link2 size={15} /> Copy links</button>
        </div>
        {note && <p className="ex-note" role="status">{note}</p>}
        <div className="lib-grid">
          {done.map((g) => (
            <button key={g.id} type="button" className={`lib-tile ex-tile${picked.has(g.id) ? " is-picked" : ""}`} onClick={() => toggle(g.id)} aria-pressed={picked.has(g.id)}>
              {g.kind === "video" ? (
                <video src={`${g.imageUrl}#t=0.1`} muted playsInline preload="metadata" aria-label={g.prompt} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.imageUrl!} alt={g.prompt} loading="lazy" decoding="async" />
              )}
              {picked.has(g.id) && <i className="ex-check"><Check size={14} /></i>}
              <span>{g.prompt}</span>
            </button>
          ))}
        </div>
        <MoreSentinel active={(renders ?? []).length >= limit} onMore={more} />
      </>) : renders ? (
        <div className="lib-empty">
          <Share2 size={46} strokeWidth={1.4} aria-hidden="true" />
          <h2>Nothing to export yet</h2>
          <p>Finished images and videos from this project appear here. Make some in <Link href="/create">Image Studio</Link> or <Link href="/generate">Video Studio</Link>.</p>
        </div>
      ) : null}
    </div>
  );
}
