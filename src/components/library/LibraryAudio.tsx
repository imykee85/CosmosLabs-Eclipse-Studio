"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, Music } from "lucide-react";
import type { AudioItem } from "@/lib/audio/jobs";

// The person's finished Voice Studio takes (voices, sound effects and music). Links are signed for a short time, so the list is fetched fresh each visit.
export default function LibraryAudio({ query }: { query: string }) {
  const [items, setItems] = useState<AudioItem[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/audio", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { items: [] })).then((d) => { if (live) setItems(Array.isArray(d.items) ? d.items : []); }).catch(() => { if (live) setItems([]); });
    return () => { live = false; };
  }, []);
  const q = query.trim().toLowerCase();
  const shown = (items ?? []).filter((a) => a.status === "completed" && a.url && a.kind !== "stt" && (!q || (a.text ?? "").toLowerCase().includes(q) || (a.voiceName ?? "").toLowerCase().includes(q)));
  if (items && !shown.length) {
    return (
      <div className="lib-empty">
        <Music size={46} strokeWidth={1.4} aria-hidden="true" />
        <h2>No audio yet</h2>
        <p>Voices, sound effects and music you make in <Link href="/voice">Voice Studio</Link> appear here.</p>
      </div>
    );
  }
  return (
    <ul className="lib-audio">
      {shown.map((a) => (
        <li key={a.id}>
          <div className="lib-audio-meta">
            <b>{(a.text ?? "").slice(0, 90) || a.modelLabel}</b>
            <span>{a.modelLabel}{a.voiceName ? ` · ${a.voiceName}` : ""}</span>
          </div>
          <audio controls preload="none" src={a.url!} />
          <a className="lib-audio-dl" href={`/api/audio/${a.id}/file?download=1`} download={a.fileName} aria-label="Download"><Download size={16} /></a>
        </li>
      ))}
    </ul>
  );
}
