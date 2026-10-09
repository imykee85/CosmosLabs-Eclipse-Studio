"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import SoonTag from "@/components/SoonTag";
import { MOTION_TAGS, hasClips, motionPrompts } from "@/lib/motion";
import MotionMedia from "./MotionMedia";
import "./motion.css";

// Motion graphics: a filterable feed of motion prompts, adapted from the user's Prompt Motion project (their own Manus build).
// The filters live in the address (?type=prompt|skill&tag=<topic>&sort=popular|newest|title) so a view can be shared and the
// back button restores it. Each card opens /motion/<id>. Cards are empty tiles until clips are added to `src/lib/motion.ts`.
const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function MotionView() {
  const router = useRouter();
  const pathname = usePathname();
  const q = useSearchParams();
  const [paused, setPaused] = useState(false);

  const kind = q.get("type") === "skill" ? "skill" : "prompt";
  const tag = MOTION_TAGS.find((t) => slug(t) === q.get("tag")) ?? null;
  const sortParam = q.get("sort");
  const sort = sortParam === "newest" || sortParam === "title" ? sortParam : "popular";

  function setView(next: { type?: string; tag?: string | null; sort?: string }) {
    const p = new URLSearchParams(q.toString());
    if (next.type !== undefined) { if (next.type === "prompt") p.delete("type"); else p.set("type", next.type); }
    if (next.tag !== undefined) { if (next.tag) p.set("tag", next.tag); else p.delete("tag"); }
    if (next.sort !== undefined) { if (next.sort === "popular") p.delete("sort"); else p.set("sort", next.sort); }
    const s = p.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }

  const items = useMemo(() => {
    const list = kind === "skill" ? [] : motionPrompts.filter((p) => !tag || p.tags.includes(tag));
    if (sort === "title") return [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "newest") return [...list].reverse();
    return list;
  }, [kind, tag, sort]);

  return (
    <div className="mo">
      <header className="mo-intro">
        <h1>Motion graphics <SoonTag /></h1>
        <p>A library of motion prompts: the exact words behind each clip, with the model and how many tries it took.</p>
      </header>

      <div className="mo-filter">
        <div className="mo-seg" role="group" aria-label="Type">
          <button type="button" aria-pressed={kind === "prompt"} onClick={() => setView({ type: "prompt" })}>Prompt</button>
          <button type="button" aria-pressed={kind === "skill"} onClick={() => setView({ type: "skill" })}>Skill</button>
        </div>
        <div className="mo-filter-right">
          <select className="mo-sort" aria-label="Sort" value={sort} onChange={(e) => setView({ sort: e.target.value })}>
            <option value="popular">Popular</option>
            <option value="newest">Newest</option>
            <option value="title">Title</option>
          </select>
          {hasClips && <button type="button" className="mo-sort" onClick={() => setPaused((v) => !v)}>{paused ? "Play previews" : "Pause previews"}</button>}
        </div>
      </div>
      <div className="mo-tags" role="group" aria-label="Topics">
        <button type="button" aria-pressed={tag === null} onClick={() => setView({ tag: null })}>All</button>
        {MOTION_TAGS.map((t) => <button key={t} type="button" aria-pressed={tag === t} onClick={() => setView({ tag: tag === t ? null : slug(t) })}>{t}</button>)}
      </div>

      {items.length === 0 ? (
        <p className="mo-empty">{kind === "skill" ? "Motion skills are coming soon." : "Nothing under this topic yet."}</p>
      ) : (
        <ul className="mo-grid">
          {items.map((p) => (
            <li key={p.id}>
              <Link href={`/motion/${p.id}`} className="mo-card" aria-label={`Open ${p.title}`}>
                <MotionMedia item={p} paused={paused} />
                <span className="mo-meta"><b>{p.title}</b><small>{p.by ? `@${p.by.name} · ` : ""}{p.tags.join(" · ")}</small></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
