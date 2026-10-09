"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, Brain, Check, Folder, Image as ImageIcon, Loader2, Puzzle, Send, Wrench } from "lucide-react";
import type { Render } from "@/lib/use-renders";

export type Part = { kind: "text"; text: string } | { kind: "tool"; name: string } | { kind: "render"; id: string };
export type Line = { role: "user" | "assistant"; parts: Part[]; error?: string };

const TOOL_LABEL: Record<string, string> = {
  generate_image: "Started a render", check_render: "Checked a render", list_recent_renders: "Looked at recent renders", list_projects: "Looked at your projects", search_library: "Searched your Library", view_render: "Looked at a render", list_image_models: "Looked up image models",
  remember: "Saved to memory", recall: "Read your memory", forget: "Removed from memory", list_skills: "Looked at skills", use_skill: "Followed a skill",
  list_connected_apps: "Checked connected apps", send_to_app: "Sent to an app",
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
    <a className="cn-render" href={r.imageUrl ?? "#"} target="_blank" rel="noreferrer" style={{ aspectRatio: (r.aspectRatio ?? "1:1").replace(":", " / ") }} title={r.prompt}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={r.imageUrl ?? ""} alt={r.prompt} onLoad={grew} />
    </a>
  );
}

// grew: called when something in the thread changes size after it was added (a render finishing), so the screen can keep the end in view.
export default function ChatThread({ lines, busy, grew }: { lines: Line[]; busy: boolean; grew: () => void }) {
  return (
    <div className="cn-thread" aria-live="polite">
      {lines.map((l, i) => (
        <div key={i} className={`cn-msg is-${l.role}`}>
          {l.parts.map((p, k) =>
            p.kind === "text" ? <p key={k} className="cn-text-part">{p.text}</p>
            : p.kind === "tool" ? <span key={k} className="cn-tool">{TOOL_ICON[p.name] ?? <Wrench size={14} />}{TOOL_LABEL[p.name] ?? p.name}<Check size={13} /></span>
            : <RenderCard key={k} id={p.id} grew={grew} />,
          )}
          {l.error && <p className="cn-err" role="alert"><AlertCircle size={15} /> {l.error}</p>}
          {l.role === "assistant" && busy && i === lines.length - 1 && !l.error && <span className="cn-working"><Loader2 size={14} className="cn-spin" /> Working</span>}
        </div>
      ))}
      {lines.length > 0 && !busy && (
        <p className="cn-foot">Renders are saved to your <Link href="/gallery">Gallery</Link> and <Link href="/library">Library</Link>.</p>
      )}
    </div>
  );
}
