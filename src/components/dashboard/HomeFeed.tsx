"use client";

import { useState } from "react";
import { ArrowRight, ChevronRight, Plus } from "lucide-react";
import SoonTag from "@/components/SoonTag";
import { skills } from "@/lib/skills";
import { tools } from "@/lib/tools";
import "./home-feed.css";

// The lower half of the dashboard: things to start from, so the page feels like a home and not only a project list.
// Every card opens its page inside the latest project (or asks for a new project first), through `onGo`. Wording and
// pictures are Eclipse's own; nothing here claims a feature that does not work (video is tagged Soon).
type Start = { id: string; title: string; image: string; path?: string };
const STARTS: Start[] = [
  { id: "image", title: "Make an image", image: "/carousel/card-5.jpg", path: "/create" },
  { id: "canvas", title: "Build on the canvas", image: "/carousel/card-8.jpg", path: "/canvas" },
  { id: "orbit", title: "Ask Orbit", image: "/carousel/card-6-poster.jpg", path: "/connect" },
  { id: "video", title: "Make a video", image: "/carousel/card-4-poster.jpg" },
];

const HERO = ["/carousel/card-5.jpg", "/carousel/card-9-poster.jpg", "/carousel/card-2-poster.jpg", "/carousel/card-6-poster.jpg"];
const EXAMPLES = ["card-12", "card-8", "card-13", "card-5", "card-14", "card-11", "card-2-poster", "card-9-poster", "card-6-poster", "card-4-poster"].map((n) => `/carousel/${n}.jpg`);

const FAQ: [string, string][] = [
  ["What can I create?", "Images today, with video and more creative tools on the roadmap. Anything tagged Soon is not ready yet."],
  ["Where do my creations go?", "Each image is saved to your private Library, and to the Gallery of the project you made it in."],
  ["What is Orbit?", "Your creative computer: a chat that can make images, follow skills, remember your style and send finished work to Telegram or Slack."],
  ["Can I use my own pictures?", "Yes. Add them under Ingredients or Assets, then pick them as references in Image Studio when the model supports it."],
];

export default function HomeFeed({ onGo }: { onGo: (path: string) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="hf" aria-label="Start something new">
      <div className="hf-sec">
        <h2>Discover</h2>
        <div className="hf-hero">
          <div className="hf-hero-pics" aria-hidden="true">{HERO.map((src) => <span key={src} style={{ backgroundImage: `url(${src})` }} />)}</div>
          <div className="hf-hero-copy">
            <small>Image Studio</small>
            <h3>Describe it, and see it</h3>
            <p>Pick a model, add reference pictures if you like, and make your first image in a minute.</p>
            <button type="button" onClick={() => onGo("/create")}>Open Image Studio</button>
          </div>
        </div>
      </div>

      <div className="hf-sec">
        <h2>Start something new</h2>
        <ul className="hf-row hf-row-big">
          {STARTS.map((s) => (
            <li key={s.id} className="hf-big" style={{ backgroundImage: `url(${s.image})` }}>
              <span className="hf-big-title">{s.title}{!s.path && <SoonTag />}</span>
              <button type="button" className="hf-try" onClick={() => s.path ? onGo(s.path) : undefined} aria-label={`${s.title}${s.path ? "" : " (coming soon)"}`}>
                Try it <ArrowRight size={15} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="hf-sec">
        <div className="hf-head"><h2>Skills by Eclipse</h2><button type="button" className="hf-more" onClick={() => onGo("/skills")}>See all <ChevronRight size={15} /></button></div>
        <p className="hf-sub">Ready-made recipes Orbit follows for a shoot, a lookbook or a campaign.</p>
        <ul className="hf-row">
          {skills.map((s) => (
            <li key={s.id} className="hf-card">
              <button type="button" onClick={() => onGo(`/connect?start=${encodeURIComponent(`Use the skill "${s.name}" (id: ${s.id}). Ask me only what you need to begin.`)}`)}>
                <span className="hf-pic" style={{ backgroundImage: `url(${s.image})` }} />
                <b>{s.name}</b>
                <small>{s.minutes} min · {s.kind === "video" ? "Video" : "Photo"}</small>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="hf-sec">
        <div className="hf-head"><h2>Tools for quick jobs</h2><button type="button" className="hf-more" onClick={() => onGo("/tools")}>See all <ChevronRight size={15} /></button></div>
        <p className="hf-sub">Small single-purpose tools, each one opens a chat that does the job with you.</p>
        <ul className="hf-row">
          {tools.map((t) => (
            <li key={t.id} className="hf-card">
              <button type="button" onClick={() => onGo(`/connect?start=${encodeURIComponent(t.start)}`)}>
                <span className="hf-pic" style={{ backgroundImage: `url(${t.image})` }} />
                <b>{t.name}</b>
                <small>{t.blurb}</small>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="hf-sec">
        <h2>Examples</h2>
        <p className="hf-sub">A look at the kind of work Eclipse makes.</p>
        <ul className="hf-masonry">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {EXAMPLES.map((src) => <li key={src}><img src={src} alt="" loading="lazy" /></li>)}
        </ul>
      </div>

      <div className="hf-sec hf-faq">
        <h2>Good to know</h2>
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
