"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import SoonTag from "@/components/SoonTag";
import { MOTION_TAGS, motionPrompts, type MotionPrompt, type MotionTag } from "@/lib/motion";
import "./motion.css";

// Motion graphics: a filterable feed of motion prompts. Cards are empty tiles until clips exist; each opens a dialog with the prompt and a Copy button.
export default function MotionView() {
  const [kind, setKind] = useState<"prompt" | "skill">("prompt");
  const [tag, setTag] = useState<MotionTag | null>(null);
  const [sort, setSort] = useState<"popular" | "newest" | "title">("popular");
  const [open, setOpen] = useState<MotionPrompt | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const items = useMemo(() => {
    const list = kind === "skill" ? [] : motionPrompts.filter((p) => !tag || p.tags.includes(tag));
    if (sort === "title") return [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "newest") return [...list].reverse();
    return list;
  }, [kind, tag, sort]);

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } finally { ta.remove(); }
    }
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="mo">
      <header className="mo-intro">
        <h1>Motion graphics <SoonTag /></h1>
        <p>A library of motion prompts: the exact words behind each clip, with the model and how many tries it took.</p>
      </header>

      <div className="mo-filter">
        <div className="mo-seg" role="group" aria-label="Type">
          <button type="button" aria-pressed={kind === "prompt"} onClick={() => setKind("prompt")}>Prompt</button>
          <button type="button" aria-pressed={kind === "skill"} onClick={() => setKind("skill")}>Skill</button>
        </div>
        <select className="mo-sort" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="popular">Popular</option>
          <option value="newest">Newest</option>
          <option value="title">Title</option>
        </select>
      </div>
      <div className="mo-tags" role="group" aria-label="Topics">
        <button type="button" aria-pressed={tag === null} onClick={() => setTag(null)}>All</button>
        {MOTION_TAGS.map((t) => <button key={t} type="button" aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>{t}</button>)}
      </div>

      {items.length === 0 ? (
        <p className="mo-empty">{kind === "skill" ? "Motion skills are coming soon." : "Nothing under this topic yet."}</p>
      ) : (
        <ul className="mo-grid">
          {items.map((p) => (
            <li key={p.id}>
              <button type="button" className="mo-card" onClick={() => setOpen(p)} aria-label={`Open ${p.title}`}>
                <span className="mo-tile" style={{ aspectRatio: p.ratio }} />
                <span className="mo-meta"><b>{p.title}</b><small>{p.tags.join(" · ")}</small></span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mo-scrim" onMouseDown={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div className="mo-dialog" role="dialog" aria-modal="true" aria-label={open.title}>
            <button type="button" className="mo-close" aria-label="Close" onClick={() => setOpen(null)}><X size={18} /></button>
            <span className="mo-tile mo-tile-big" style={{ aspectRatio: open.ratio }} />
            <div className="mo-detail">
              <h2>{open.title}</h2>
              <dl>
                <div><dt>Model</dt><dd>{open.model}</dd></div>
                <div><dt>Tries</dt><dd>{open.tries}</dd></div>
                <div><dt>Topics</dt><dd>{open.tags.join(", ")}</dd></div>
              </dl>
              <h3>Prompt</h3>
              <p className="mo-prompt">{open.prompt}</p>
              <button type="button" className="mo-copy" onClick={() => copy(open.prompt)}>{copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy prompt</>}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
