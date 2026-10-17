"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, RotateCcw, Trash2 } from "lucide-react";
import { timeAgo } from "@/lib/projects";
import type { AudioItem } from "@/lib/audio/jobs";

// Voice takes, sound effects and music moved to the Bin from Voice Studio. Restoring puts one back in the list; deleting forever removes the file.
export default function BinAudio({ query }: { query: string }) {
  const [items, setItems] = useState<AudioItem[] | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { const r = await fetch("/api/audio?bin=1", { cache: "no-store" }); const d = r.ok ? await r.json() : { items: [] }; setItems(Array.isArray(d.items) ? d.items : []); } catch { setItems([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const q = query.trim().toLowerCase();
  const shown = (items ?? []).filter((a) => !q || a.text.toLowerCase().includes(q) || (a.voiceName ?? "").toLowerCase().includes(q));

  async function act(id: string, init: RequestInit, url = `/api/audio/${id}`) {
    setError("");
    const r = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init }).catch(() => null);
    if (!r?.ok) { setError("Something went wrong. Please try again."); return; }
    setConfirm(null); await load();
  }

  if (items === null) return <p className="db-loading" aria-live="polite">Loading…</p>;
  return (
    <>
      {error && <p className="db-error" role="alert">{error}</p>}
      {shown.length > 0 ? (
        <ul className="bi-grid">
          {shown.map((a) => (
            <li key={a.id} className="bi-card">
              <p className="bi-prompt" title={a.text}>{a.text || a.modelLabel}</p>
              {a.url && <audio controls preload="none" src={a.url} style={{ width: "100%", height: 36 }} />}
              <p className="db-meta"><Clock size={13} /> Deleted {a.deletedAt ? timeAgo(a.deletedAt) : ""}</p>
              <p className="bi-from">{a.modelLabel}{a.voiceName ? ` · ${a.voiceName}` : ""}</p>
              <div className="db-bin-actions">
                <button type="button" onClick={() => act(a.id, { method: "PATCH", body: JSON.stringify({ action: "restore" }) })}><RotateCcw size={14} /> Restore</button>
                {confirm === a.id ? (
                  <button type="button" className="is-danger" onClick={() => act(a.id, { method: "DELETE" }, `/api/audio/${a.id}?forever=1`)}><Trash2 size={14} /> Yes, delete</button>
                ) : (
                  <button type="button" className="is-danger" onClick={() => setConfirm(a.id)}><Trash2 size={14} /> Delete forever</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <section className="db-empty" aria-live="polite">
          <h1>{q ? "No matches" : "No deleted audio"}</h1>
          <p>{q ? "Nothing in the bin matches your search." : "Voices, sound effects and music you delete in Voice Studio show up here."}</p>
        </section>
      )}
    </>
  );
}
