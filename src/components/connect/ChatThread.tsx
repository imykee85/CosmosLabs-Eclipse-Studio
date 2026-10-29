"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Brain, Check, Folder, Image as ImageIcon, Loader2, Puzzle, Send, Square, Volume2, Wrench } from "lucide-react";
import type { Render } from "@/lib/use-renders";

type Part = { kind: "text"; text: string } | { kind: "tool"; name: string } | { kind: "render"; id: string } | { kind: "send"; id: string };
export type Line = { role: "user" | "assistant"; parts: Part[]; error?: string };

const TOOL_LABEL: Record<string, string> = {
  generate_image: "Started a render", check_render: "Checked a render", list_recent_renders: "Looked at recent renders", list_projects: "Looked at your projects", search_library: "Searched your Library", view_render: "Looked at a render", list_image_models: "Looked up image models",
  remember: "Saved to memory", recall: "Read your memory", forget: "Removed from memory", list_skills: "Looked at skills", use_skill: "Followed a skill",
  list_connected_apps: "Checked connected apps", send_to_app: "Prepared a message",
};
const TOOL_ICON: Record<string, React.ReactNode> = {
  generate_image: <ImageIcon size={14} />, check_render: <ImageIcon size={14} />, list_recent_renders: <ImageIcon size={14} />, list_projects: <Folder size={14} />, search_library: <ImageIcon size={14} />, view_render: <ImageIcon size={14} />, list_image_models: <ImageIcon size={14} />,
  remember: <Brain size={14} />, recall: <Brain size={14} />, forget: <Brain size={14} />, list_skills: <Puzzle size={14} />, use_skill: <Puzzle size={14} />,
  list_connected_apps: <Send size={14} />, send_to_app: <Send size={14} />,
};

// A render the assistant started: shows progress, then the picture, and keeps checking until it is done.
function RenderCard({ id, grew }: { id: string; grew: () => void }) {
  const [r, setR] = useState<Render | null>(null);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const res = await fetch(`/api/generations/${id}`, { cache: "no-store" });
        if (res.status === 404) { setGone(true); return; }
        if (res.ok) {
          const item: Render = await res.json();
          if (stop) return;
          setR(item);
          if (item.status !== "pending") return;
        }
      } catch {}
      if (!stop) timer = setTimeout(poll, 3000);
    }
    poll();
    return () => { stop = true; clearTimeout(timer); };
  }, [id]);

  useEffect(() => { grew(); }, [r?.status, gone]); // eslint-disable-line react-hooks/exhaustive-deps

  if (gone) return <div className="cn-render is-note"><AlertCircle size={16} /> This render was deleted.</div>;
  if (!r || r.status === "pending") return <div className="cn-render is-note"><Loader2 size={16} className="cn-spin" /> Rendering{r?.prompt ? `: ${r.prompt.slice(0, 80)}` : "…"}</div>;
  if (r.status === "failed") return <div className="cn-render is-note"><AlertCircle size={16} /> {r.error ?? "This render could not be made."}</div>;
  return (
    <a className="cn-render" href={`/api/generations/${r.id}/file`} target="_blank" rel="noreferrer" style={{ aspectRatio: (r.aspectRatio ?? "1:1").replace(":", " / ") }} title={r.prompt}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={r.imageUrl ?? ""} alt={r.prompt} onLoad={grew} />
    </a>
  );
}


type SendInfo = { appName: string; destination: string; text: string; hasPicture: boolean; status: string; error?: string | null };

// A message the assistant prepared for a connected app. Nothing leaves until the person presses Send here (the server enforces it).
function SendCard({ id, grew }: { id: string; grew: () => void }) {
  const [info, setInfo] = useState<SendInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    let stop = false;
    fetch(`/api/connect/sends/${id}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => { if (!stop && d) setInfo(d); }).catch(() => {});
    return () => { stop = true; };
  }, [id]);
  useEffect(() => { grew(); }, [info?.status, err]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!info) return <div className="cn-sc is-note"><Loader2 size={16} className="cn-spin" /> Preparing a message…</div>;
  const decide = async (action: "send" | "cancel") => {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/connect/sends/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok || d.status) setInfo((i) => (i ? { ...i, status: d.status ?? i.status, error: d.error ?? null } : i));
      if (!r.ok) setErr(d.error ?? "That did not work. Please try again.");
    } catch { setErr("The connection dropped. Please try again."); }
    setBusy(false);
  };
  const where = info.destination ? `${info.appName} (${info.destination})` : info.appName;
  return (
    <div className={`cn-sc is-${info.status}`}>
      <div className="cn-sc-head"><Send size={14} /> {info.status === "sent" ? `Sent to ${where}` : info.status === "canceled" ? `Canceled: not sent to ${where}` : info.status === "expired" ? `Expired: not sent to ${where}` : info.status === "failed" ? `Could not send to ${where}` : `Send to ${where}?`}</div>
      <p className="cn-sc-text">{info.text}</p>
      {info.hasPicture && <span className="cn-sc-pic"><ImageIcon size={13} /> A picture is attached</span>}
      {(err || (info.status === "failed" && info.error)) && <p className="cn-err" role="alert"><AlertCircle size={15} /> {err || info.error}</p>}
      {info.status === "pending" && (
        <div className="cn-sc-actions">
          <button type="button" className="cn-sc-go" disabled={busy} onClick={() => decide("send")}>Send</button>
          <button type="button" className="cn-sc-no" disabled={busy} onClick={() => decide("cancel")}>Cancel</button>
        </div>
      )}
    </div>
  );
}

// Read a reply aloud with the device's own voice (owner 2026-10-19: a voice icon on Core). Tapping again stops it.
function ReadAloud({ text }: { text: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => () => { if (on) window.speechSynthesis?.cancel(); }, [on]);
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) return null;
  const toggle = () => {
    const synth = window.speechSynthesis;
    if (on) { synth.cancel(); setOn(false); return; }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.slice(0, 6000));
    u.lang = document.documentElement.lang || navigator.language || "en-US";
    u.onend = () => setOn(false); u.onerror = () => setOn(false);
    synth.speak(u); setOn(true);
  };
  return <button type="button" className="cn-read" onClick={toggle} aria-label={on ? "Stop reading" : "Read aloud"} title={on ? "Stop reading" : "Read aloud"}>{on ? <Square size={13} /> : <Volume2 size={15} />}</button>;
}

// grew: called when something in the thread changes size after it was added (a render finishing), so the screen can keep the end in view.
export default function ChatThread({ lines, busy, grew }: { lines: Line[]; busy: boolean; grew: () => void }) {
  return (
    <div className="cn-thread" aria-live="polite">
      {lines.map((l, i) => (
        <div key={i} className={`cn-msg is-${l.role}`}>
          {l.parts.map((p, k) =>
            p.kind === "text" ? <p key={k} className="cn-text-part">{p.text}</p>
            : p.kind === "tool" ? <span key={k} className="cn-tool">{TOOL_ICON[p.name] ?? <Wrench size={14} />}{TOOL_LABEL[p.name] ?? (p.name.startsWith("sandbox") ? "Worked in the build space" : "Used a tool")}<Check size={13} /></span>
            : p.kind === "send" ? <SendCard key={k} id={p.id} grew={grew} />
            : <RenderCard key={k} id={p.id} grew={grew} />,
          )}
          {l.error && <p className="cn-err" role="alert"><AlertCircle size={15} /> {l.error}</p>}
          {l.role === "assistant" && busy && i === lines.length - 1 && !l.error && <span className="cn-working"><Loader2 size={14} className="cn-spin" /> Working</span>}
          {l.role === "assistant" && !(busy && i === lines.length - 1) && <ReadAloud text={l.parts.map((p) => (p.kind === "text" ? p.text : "")).join(" ")} />}
        </div>
      ))}
    </div>
  );
}
