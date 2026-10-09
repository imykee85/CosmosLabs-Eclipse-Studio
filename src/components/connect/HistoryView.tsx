"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, MessageSquare, SquarePen, Trash2 } from "lucide-react";
import "./connect.css";

type ChatSummary = { id: string; title: string; updatedAt: string };

// Every earlier chat with the assistant, newest first. Opening one continues it in Connect.
export default function HistoryView() {
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/connect/chats", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setChats(data.chats); else { setChats([]); setError(res.status === 503 ? "Sign in to keep your chats." : data.error ?? "Could not load your chats."); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function drop(c: ChatSummary) {
    if (!window.confirm(`Delete “${c.title}”? This cannot be undone.`)) return;
    setChats((l) => l?.filter((x) => x.id !== c.id) ?? null);
    const res = await fetch(`/api/connect/chats/${c.id}`, { method: "DELETE" });
    if (!res.ok) { setError("Could not delete that chat."); load(); }
  }

  return (
    <div className="cn-wrap cn-history">
      <header className="cn-head">
        <Link href="/connect" className="cn-back" aria-label="Back to Connect"><ChevronLeft size={22} /></Link>
        <h1 className="pg-title">History</h1>
        <Link href="/connect" className="cn-corner-btn cn-head-new" aria-label="New chat" title="New chat"><SquarePen size={18} /></Link>
      </header>
      {error && <p className="cn-err" role="alert">{error}</p>}
      {chats === null ? <p className="cn-pop-note">Loading…</p> : chats.length === 0 ? (
        <div className="cn-empty"><MessageSquare size={30} strokeWidth={1.4} /><p>No chats yet. Start one from Connect and it will be saved here.</p></div>
      ) : (
        <ul className="cn-hist-list">
          {chats.map((c) => (
            <li key={c.id}>
              <Link href={`/connect?chat=${c.id}`} className="cn-hist-main"><b>{c.title}</b><small>{new Date(c.updatedAt).toLocaleString()}</small></Link>
              <button type="button" className="cn-pop-del" aria-label={`Delete ${c.title}`} onClick={() => drop(c)}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
