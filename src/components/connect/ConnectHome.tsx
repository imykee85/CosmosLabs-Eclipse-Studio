"use client";

import Link from "next/link";
import { KeyboardEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, Brain, Clock, Plus, Puzzle, SquarePen, Trash2, Wrench, X } from "lucide-react";
import { MODEL_KEY } from "@/lib/connect-models";
import { readCurrentProject } from "@/lib/projects";
import { useRenders } from "@/lib/use-renders";
import BrandLogo from "./brands";
import ChatThread, { type Line } from "./ChatThread";
import ModelPicker from "./ModelPicker";
import "./connect.css";

type ChatSummary = { id: string; title: string; updatedAt: string };

// Connect: the assistant. Chat with it, let it use skills, tools, memory and your connected apps, and send finished content on.
function ConnectChat() {
  const router = useRouter();
  const params = useSearchParams();
  const [text, setText] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ChatSummary[] | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const started = useRef(false);
  const { renders } = useRenders(attachOpen ? undefined : null, 16);

  // Open an earlier chat from the link (?chat=), or send a message handed over by Skills or Tools (?start=), once.
  const open = useCallback(async (id: string) => {
    setNotice("");
    const res = await fetch(`/api/connect/chats/${id}`, { cache: "no-store" });
    if (!res.ok) { setNotice(res.status === 503 ? "Sign in to use the assistant." : "That chat could not be opened."); return; }
    const data = await res.json();
    setChatId(data.id);
    setLines(data.lines);
  }, []);

  const send = useCallback(async (message: string, images: string[] = []) => {
    const clean = message.trim();
    if (!clean || busy) return;
    setBusy(true);
    setNotice("");
    setText("");
    setPicked([]);
    setAttachOpen(false);
    setLines((l) => [...l, { role: "user", parts: [{ kind: "text", text: images.length ? `${clean}\n(${images.length} picture${images.length > 1 ? "s" : ""} attached)` : clean }] }, { role: "assistant", parts: [] }]);
    const patch = (fn: (a: Line) => Line) => setLines((l) => { const c = [...l]; c[c.length - 1] = fn(c[c.length - 1]); return c; });
    try {
      let model = "auto";
      try { model = localStorage.getItem(MODEL_KEY) ?? "auto"; } catch {}
      const res = await fetch("/api/connect/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: clean, chatId, model, images, projectId: readCurrentProject()?.id }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        patch((a) => ({ ...a, error: data.error ?? "Something went wrong. Please try again." }));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const raw = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!raw) continue;
          let e: { t: string; id?: string; d?: string; name?: string; message?: string };
          try { e = JSON.parse(raw); } catch { continue; }
          if (e.t === "chat" && e.id) { setChatId(e.id); window.history.replaceState(null, "", `/connect?chat=${e.id}`); }
          else if (e.t === "text" && e.d) patch((a) => {
            const parts = [...a.parts]; const last = parts[parts.length - 1];
            if (last?.kind === "text") parts[parts.length - 1] = { kind: "text", text: last.text + e.d };
            else parts.push({ kind: "text", text: e.d! });
            return { ...a, parts };
          });
          else if (e.t === "tool" && e.name) patch((a) => ({ ...a, parts: [...a.parts, { kind: "tool", name: e.name! }] }));
          else if (e.t === "render" && e.id) patch((a) => ({ ...a, parts: [...a.parts, { kind: "render", id: e.id! }] }));
          else if (e.t === "error") patch((a) => ({ ...a, error: e.message }));
        }
      }
    } catch {
      patch((a) => ({ ...a, error: "The connection dropped. Reload this chat to see what was saved." }));
    } finally {
      setBusy(false);
      setHistory(null);
    }
  }, [busy, chatId]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const c = params.get("chat");
    const s = params.get("start");
    if (c) open(c);
    else if (s) { router.replace("/connect"); send(s); }
  }, [params, open, router, send]);

  const scrollEnd = useCallback(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, []);
  useEffect(() => { scrollEnd(); }, [lines, scrollEnd]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  async function showHistory() {
    const next = !historyOpen;
    setHistoryOpen(next);
    setAttachOpen(false);
    if (next && !history) {
      const res = await fetch("/api/connect/chats", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setHistory(res.ok ? data.chats : []);
      if (!res.ok) setNotice(data.error ?? "Could not load your chats.");
    }
  }
  function fresh() {
    setChatId(null); setLines([]); setNotice(""); setHistoryOpen(false); setPicked([]);
    window.history.replaceState(null, "", "/connect");
  }
  async function drop(id: string) {
    await fetch(`/api/connect/chats/${id}`, { method: "DELETE" });
    setHistory((h) => h?.filter((c) => c.id !== id) ?? null);
    if (id === chatId) fresh();
  }
  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !window.matchMedia("(pointer: coarse)").matches) { e.preventDefault(); send(text, picked); }
  }
  const togglePick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 3 ? [...p, id] : p));
  const done = (renders ?? []).filter((r) => r.status === "completed" && r.imageUrl);
  const chatting = lines.length > 0;

  return (
    <div className={`cn-wrap cn-chat ${chatting ? "is-chatting" : ""}`}>
      <div className="cn-corner">
        <button type="button" className="cn-corner-btn" onClick={showHistory} aria-expanded={historyOpen} aria-label="History" title="History"><Clock size={18} /></button>
        {chatting && <button type="button" className="cn-corner-btn" onClick={fresh} aria-label="New chat" title="New chat"><SquarePen size={18} /></button>}
        {historyOpen && (
        <div className="cn-pop cn-corner-pop" role="dialog" aria-label="Your chats">
          {history === null ? <p className="cn-pop-note">Loading…</p> : history.length === 0 ? <p className="cn-pop-note">No chats yet.</p> : (
            <ul>
              {history.map((c) => (
                <li key={c.id} className={c.id === chatId ? "is-on" : ""}>
                  <button type="button" className="cn-pop-main" onClick={() => { setHistoryOpen(false); open(c.id); window.history.replaceState(null, "", `/connect?chat=${c.id}`); }}>
                    <b>{c.title}</b><small>{new Date(c.updatedAt).toLocaleString()}</small>
                  </button>
                  <button type="button" className="cn-pop-del" aria-label={`Delete ${c.title}`} onClick={() => drop(c.id)}><Trash2 size={16} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
        )}
      </div>

      {chatting ? (
        <>
          <ChatThread lines={lines} busy={busy} grew={scrollEnd} />
        </>
      ) : (
        <div className="cn-hero">
          <div className="cn-dests" aria-hidden="true">
            {["tiktok", "instagram", "telegram", "slack", "youtube"].map((b) => <BrandLogo key={b} brand={b} size={48} />)}
          </div>
          <h1>Where should it go next?</h1>
          <p>Ask for an image, run a skill, or send finished content to your apps.</p>
        </div>
      )}

      <div className="cn-dock">
        <div className="cn-chips">
          <Link href="/skills" className="cn-chip"><Puzzle size={15} /> Skills</Link>
          <Link href="/tools" className="cn-chip"><Wrench size={15} /> Tools</Link>
          <Link href="/memory" className="cn-chip"><Brain size={15} /> Memory</Link>
          <Link href="/connect/apps" className="cn-chip">
            <span className="cn-stack" aria-hidden="true">{["tiktok", "telegram", "youtube"].map((b) => <BrandLogo key={b} brand={b} size={24} />)}</span> Connectors
          </Link>
        </div>

        {attachOpen && (
          <div className="cn-pop cn-attach" role="dialog" aria-label="Attach pictures from your Library">
            <p className="cn-pop-note">Pick up to 3 pictures from your Library</p>
            {renders === null ? <p className="cn-pop-note">Loading…</p> : done.length === 0 ? <p className="cn-pop-note">You have no finished renders yet.</p> : (
              <div className="cn-grid">
                {done.map((r) => (
                  <button key={r.id} type="button" className={picked.includes(r.id) ? "is-on" : ""} onClick={() => togglePick(r.id)} aria-pressed={picked.includes(r.id)} title={r.prompt}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.imageUrl ?? ""} alt={r.prompt} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <form className="cn-box" onSubmit={(e) => { e.preventDefault(); send(text, picked); }}>
          {picked.length > 0 && (
            <div className="cn-picked">
              {picked.map((id) => {
                const r = (renders ?? []).find((x) => x.id === id);
                return (
                  <span key={id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r?.imageUrl && <img src={r.imageUrl} alt="" />}
                    <button type="button" aria-label="Remove picture" onClick={() => togglePick(id)}><X size={12} /></button>
                  </span>
                );
              })}
            </div>
          )}
          <textarea ref={box} rows={2} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} aria-label="Message box" maxLength={8000}
            placeholder={chatting ? "Reply…" : "Ask for an image, run a skill, or send something to an app..."} />
          {notice && <p className="cn-err" role="alert">{notice}</p>}
          <div className="cn-tools">
            <button type="button" className="cn-round" aria-label="Attach pictures from your Library" aria-expanded={attachOpen} onClick={() => { setAttachOpen(!attachOpen); setHistoryOpen(false); }}><Plus size={18} /></button>
            <ModelPicker />
            <button type="submit" className="cn-send" aria-label="Send" disabled={busy || !text.trim()}><ArrowUp size={18} /></button>
          </div>
        </form>
      </div>
      <div ref={end} />
    </div>
  );
}

export default function ConnectHome() {
  return <Suspense fallback={null}><ConnectChat /></Suspense>;
}
