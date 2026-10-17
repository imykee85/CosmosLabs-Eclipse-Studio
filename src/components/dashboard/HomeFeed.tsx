"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, MoreVertical, Plus } from "lucide-react";
import SoonTag from "@/components/SoonTag";
import { useRenders } from "@/lib/use-renders";
import { fallbackTo, thumbOf } from "@/lib/thumb-url";
import type { Project } from "@/lib/projects";
import "./home-feed.css";

// The lower half of the dashboard, laid out as a long home page: collections, series, video, looks, tools, questions.
// Cards with no real content behind them stay EMPTY placeholders on purpose (no pictures, no invented counts) and their
// sections carry a Soon tag. Working: the series row (the person's own latest projects with their newest pictures, opening
// that project's Gallery), "Discover all videos" (/motion), "Discover all tools" (/tools), Generate an image and Generate
// a video (Image or Video Studio inside the latest project through `onGo`, or the New Project popup first).
const FAQ: [string, string][] = [
  ["What can I create?", "Images, videos, voices, sound effects and music. Anything tagged Soon is not ready yet."],
  ["Where do my creations go?", "Everything you make is saved to your private Library; images and videos also go to the Gallery of the project you made them in."],
  ["What is Core?", "Your creative computer: a chat that can make images, follow skills, remember your style and send finished work to apps such as Telegram, Slack, Discord, email, Notion or Linear."],
  ["Can I use my own pictures?", "Yes. Add them under Ingredients or Assets, then pick them as references in Image Studio when the model supports it."],
];

// A muted looping clip that plays all the time, on screen or not (and not at all when the device asks for reduced motion).
// Phones are strict about autoplay: the video must be muted as a real attribute (React only sets the property), so it is set
// here before play(); if the browser still refuses (for example iPhone Low Power Mode) it tries again on the first touch, scroll
// or key press, and whenever the tab comes back.
function LoopVideo({ src, webm, poster, className = "" }: { src: string; webm: string; poster: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [still, setStill] = useState(false);
  useEffect(() => {
    const v = ref.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setStill(reduce);
    if (!v || reduce) return;
    v.muted = true; v.defaultMuted = true; v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    const go = () => { if (v.paused) v.play().catch(() => {}); };
    const events = ["touchstart", "pointerdown", "scroll", "keydown"] as const;
    const retry = () => { go(); if (!v.paused) events.forEach((e) => window.removeEventListener(e, retry)); };
    events.forEach((e) => window.addEventListener(e, retry, { passive: true }));
    const vis = () => { if (document.visibilityState === "visible") go(); };
    document.addEventListener("visibilitychange", vis);
    v.addEventListener("loadeddata", go); v.addEventListener("canplay", go);
    go();
    return () => { events.forEach((e) => window.removeEventListener(e, retry)); document.removeEventListener("visibilitychange", vis); v.removeEventListener("loadeddata", go); v.removeEventListener("canplay", go); };
  }, []);
  return (
    <video ref={ref} className={className} poster={poster} muted loop playsInline autoPlay={!still} preload="metadata" aria-hidden="true">
      <source src={src} type="video/mp4" />
      <source src={webm} type="video/webm" />
    </video>
  );
}

const Empty = ({ className = "" }: { className?: string }) => <span className={`hf-empty ${className}`} />;

function Head({ title, sub, button, soon = true, onButton }: { title: string; sub?: string; button?: string; soon?: boolean; onButton?: () => void }) {
  return (
    <>
      <h2>{title}{soon && !button && <SoonTag />}</h2>
      {sub && <p className="hf-sub">{sub}</p>}
      {button && <button type="button" className="hf-pill" onClick={onButton}>{button}{soon && <SoonTag />}</button>}
    </>
  );
}

// The person's three most recently worked-on projects that have finished pictures, each with its four newest pictures.
function useSeries(projects: Project[]) {
  const { renders } = useRenders(undefined, 60);
  return useMemo(() => {
    const live = new Map(projects.filter((p) => !p.deletedAt).map((p) => [p.id, p]));
    const out: { project: Project; pics: { id: string; url: string; full: string }[] }[] = [];
    for (const r of renders ?? []) {
      if (r.status !== "completed" || r.kind === "video" || !r.imageUrl || !r.projectId || !live.has(r.projectId)) continue;
      let row = out.find((x) => x.project.id === r.projectId);
      if (!row) { if (out.length >= 3) continue; row = { project: live.get(r.projectId)!, pics: [] }; out.push(row); }
      if (row.pics.length < 4) row.pics.push({ id: r.id, url: thumbOf("render", r.id), full: r.imageUrl });
    }
    return out;
  }, [renders, projects]);
}

export default function HomeFeed({ onGo, projects = [], onOpenProject }: { onGo: (path: string) => void; projects?: Project[]; onOpenProject?: (p: Project, path: string) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const series = useSeries(projects);
  return (
    <section className="hf" aria-label="Home">
      <div className="hf-sec">
        <button type="button" className="hf-pill">Explore collections <SoonTag /></button>
        <ul className="hf-row">
          {["Product shots", "Portraits", "Interiors"].map((n) => (
            <li key={n} className="hf-col">
              <div className="hf-quad">
                {n === "Product shots"
                  ? [1, 2, 3, 4].map((i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} className="hf-pic" src={`/dashboard/product-${i}.jpg`} alt="" loading="lazy" draggable={false} />
                  ))
                  : <><Empty /><Empty /><Empty /><Empty /></>}
              </div>
              <div className="hf-col-meta"><b>{n}</b><MoreVertical size={16} aria-hidden="true" /></div>
            </li>
          ))}
        </ul>
      </div>

      <div className="hf-sec">
        <Head title="Keep every project consistent" sub="Your latest projects side by side, so every series stays aligned." soon={!series.length} />
        <ul className="hf-row">
          {[0, 1, 2].map((i) => {
            const row = series[i];
            if (!row) return <li key={i} className="hf-series"><Empty className="hf-series-main" /><div className="hf-thumbs"><Empty /><Empty /><Empty /></div></li>;
            const [main, ...rest] = row.pics;
            return (
              <li key={row.project.id} className="hf-series">
                <button type="button" className="hf-series-btn" onClick={() => onOpenProject?.(row.project, "/gallery")} aria-label={`Open the Gallery of ${row.project.name}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="hf-series-main hf-pic" src={main.url} onError={fallbackTo(main.full)} alt="" loading="lazy" decoding="async" draggable={false} />
                  <div className="hf-thumbs">
                    {[0, 1, 2].map((k) => rest[k]
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img key={k} className="hf-pic" src={rest[k].url} onError={fallbackTo(rest[k].full)} alt="" loading="lazy" decoding="async" draggable={false} />
                      : <Empty key={k} />)}
                  </div>
                </button>
                <div className="hf-col-meta"><b>{row.project.name}</b></div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="hf-sec">
        <Head title="A video library for every idea" sub="Find footage, templates and motion to power up your projects." button="Discover all videos" soon={false} onButton={() => onGo("/motion")} />
        <ul className="hf-row hf-row-2">
          <li className="hf-wide">
            <Link href="/motion" className="hf-wide-link" aria-label="Motion graphics"><LoopVideo className="hf-fill hf-video" src="/dashboard/motion-card.mp4" webm="/dashboard/motion-card.webm" poster="/dashboard/motion-card-poster.jpg" /><span className="hf-label hf-label-on-video">Motion graphics</span></Link>
          </li>
          <li className="hf-wide"><Empty className="hf-fill" /><span className="hf-label">Video templates</span></li>
        </ul>
      </div>

      <div className="hf-sec">
        <Head title="Looks for every style" sub="Browse photo, product and illustration looks for all your creative needs." button="Discover all looks" />
        <ul className="hf-row hf-row-2">
          {["Photography", "Illustration"].map((n) => (
            <li key={n} className="hf-looks">
              <b>{n}</b>
              <div className="hf-dots">{Array.from({ length: 12 }, (_, i) => <Empty key={i} className="hf-dot" />)}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="hf-sec">
        <Head title="Tools to skyrocket your creative freedom" button="Discover all tools" soon={false} onButton={() => onGo("/tools")} />
        <ul className="hf-row hf-row-2">
          <li className="hf-tool">
            <Empty className="hf-fill" />
            <span className="hf-tool-title">Generate an image</span>
            <button type="button" className="hf-try" onClick={() => onGo("/create")}>Try it <ArrowRight size={15} /></button>
          </li>
          <li className="hf-tool">
            <Empty className="hf-fill" />
            <span className="hf-tool-title">Generate a video</span>
            <button type="button" className="hf-try" onClick={() => onGo("/generate")}>Try it <ArrowRight size={15} /></button>
          </li>
        </ul>
      </div>

      <div className="hf-sec hf-faq">
        <h2>Frequently asked questions</h2>
        <ul>
          {FAQ.map(([q, a], i) => (
            <li key={q}>
              <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                <span>{q}</span><Plus size={18} className={open === i ? "is-open" : ""} />
              </button>
              {open === i && <p>{a}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
