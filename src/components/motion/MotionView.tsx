"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Pause, Play } from "lucide-react";
import { MOTION_TAGS, motionPrompts, postUrl, tagCount, type MotionPrompt } from "@/lib/motion";
import MotionMedia from "./MotionMedia";
import "./motion.css";

// Motion graphics: a filterable feed of motion prompts, adapted from the user's Prompt Motion project (their own Manus build).
// Topic chips show how many videos each topic holds; filters live in the address (?tag=<topic>&sort=popular|newest|title) so a
// view can be shared and the back button restores it. Every card plays its clip and opens /motion/<id>. Shown in pages of PAGE so the feed stays light.
const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const PAGE = 24;

function Card({ p, paused }: { p: MotionPrompt; paused: boolean }) {
  return (
    <li className="mo-item">
      <Link href={`/motion/${p.id}`} className="mo-media-link" aria-label={`Open ${p.title}`}><MotionMedia item={p} paused={paused} /></Link>
      <div className="mo-meta">
        <span><a className="mo-handle" href={postUrl(p)} target="_blank" rel="noopener noreferrer" title="Open the original post on X">@{p.handle}</a></span>
        <Link href={`/motion/${p.id}`} className="mo-kind" aria-label={`Open the prompt for ${p.title}`}>Prompt</Link>
      </div>
    </li>
  );
}

export default function MotionView() {
  const router = useRouter();
  const pathname = usePathname();
  const q = useSearchParams();
  const [paused, setPaused] = useState(false);
  const [shown, setShown] = useState(PAGE);

  const tag = MOTION_TAGS.find((t) => slug(t) === q.get("tag")) ?? null;
  const sortParam = q.get("sort");
  const sort = sortParam === "newest" || sortParam === "title" ? sortParam : "popular";

  useEffect(() => setShown(PAGE), [tag, sort]);

  function setView(next: { tag?: string | null; sort?: string }) {
    const p = new URLSearchParams(q.toString());
    if (next.tag !== undefined) { if (next.tag) p.set("tag", next.tag); else p.delete("tag"); }
    if (next.sort !== undefined) { if (next.sort === "popular") p.delete("sort"); else p.set("sort", next.sort); }
    const s = p.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }

  const items = useMemo(() => {
    const list = motionPrompts.filter((p) => !tag || p.tags.includes(tag));
    if (sort === "title") return [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "newest") return [...list].reverse();
    return list;
  }, [tag, sort]);

  return (
    <div className="mo">
      <header className="mo-intro">
        <h1>Motion graphics</h1>
        <p>Motion videos made with AI, with the prompts behind them. Every video is credited to its creator, with a link to their post on X.</p>
      </header>

      <div className="mo-filter">
        <span className="mo-count">{items.length} {items.length === 1 ? "video" : "videos"}</span>
        <div className="mo-filter-right">
          <select className="mo-sort" aria-label="Sort" value={sort} onChange={(e) => setView({ sort: e.target.value })}>
            <option value="popular">Popular</option>
            <option value="newest">Newest</option>
            <option value="title">Title</option>
          </select>
          <button type="button" className="mo-playpause" onClick={() => setPaused((v) => !v)} aria-label={paused ? "Play previews" : "Pause previews"} title={paused ? "Play previews" : "Pause previews"}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>
        </div>
      </div>
      <div className="mo-tags" role="group" aria-label="Topics">
        <button type="button" aria-pressed={tag === null} onClick={() => setView({ tag: null })}>All <i>{motionPrompts.length}</i></button>
        {MOTION_TAGS.map((t) => <button key={t} type="button" aria-pressed={tag === t} onClick={() => setView({ tag: tag === t ? null : slug(t) })}>{t} <i>{tagCount(t)}</i></button>)}
      </div>

      {items.length === 0 ? (
        <p className="mo-empty">Nothing under this topic yet.</p>
      ) : (
        <>
          <ul className="mo-grid">{items.slice(0, shown).map((p) => <Card key={p.id} p={p} paused={paused} />)}</ul>
          {shown < items.length && <button type="button" className="mo-more" onClick={() => setShown((n) => n + PAGE)}>Show more ({items.length - shown} left)</button>}
        </>
      )}
    </div>
  );
}
