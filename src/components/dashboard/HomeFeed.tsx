"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, MoreVertical, Plus } from "lucide-react";
import SoonTag from "@/components/SoonTag";
import "./home-feed.css";

// The lower half of the dashboard, laid out as a long home page: collections, series, video, looks, tools, questions.
// The cards are EMPTY placeholders on purpose (no pictures, no invented counts) until real content exists; every section
// that has nothing behind it yet carries a Soon tag. "Generate an image" is the one working card: it opens Image Studio
// inside the latest project through `onGo` (or asks for a new project first). "Motion graphics" opens /motion.
const FAQ: [string, string][] = [
  ["What can I create?", "Images today, with video and more creative tools on the roadmap. Anything tagged Soon is not ready yet."],
  ["Where do my creations go?", "Each image is saved to your private Library, and to the Gallery of the project you made it in."],
  ["What is Orbit?", "Your creative computer: a chat that can make images, follow skills, remember your style and send finished work to Telegram or Slack."],
  ["Can I use my own pictures?", "Yes. Add them under Ingredients or Assets, then pick them as references in Image Studio when the model supports it."],
];

const Empty = ({ className = "" }: { className?: string }) => <span className={`hf-empty ${className}`} />;

function Head({ title, sub, button, soon = true }: { title: string; sub?: string; button?: string; soon?: boolean }) {
  return (
    <>
      <h2>{title}{soon && !button && <SoonTag />}</h2>
      {sub && <p className="hf-sub">{sub}</p>}
      {button && <button type="button" className="hf-pill">{button}{soon && <SoonTag />}</button>}
    </>
  );
}

export default function HomeFeed({ onGo }: { onGo: (path: string) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="hf" aria-label="Home">
      <div className="hf-sec">
        <button type="button" className="hf-pill">Explore collections <SoonTag /></button>
        <ul className="hf-row">
          {["Product shots", "Portraits", "Interiors"].map((n) => (
            <li key={n} className="hf-col">
              <div className="hf-quad"><Empty /><Empty /><Empty /><Empty /></div>
              <div className="hf-col-meta"><b>{n}</b><MoreVertical size={16} aria-hidden="true" /></div>
            </li>
          ))}
        </ul>
      </div>

      <div className="hf-sec">
        <Head title="Keep every project consistent" sub="Find pictures from the same series and keep your work aligned." />
        <ul className="hf-row">
          {[0, 1, 2].map((i) => (
            <li key={i} className="hf-series">
              <Empty className="hf-series-main" />
              <div className="hf-thumbs"><Empty /><Empty /><Empty /></div>
            </li>
          ))}
        </ul>
      </div>

      <div className="hf-sec">
        <Head title="A video library for every idea" sub="Find footage, templates and motion to power up your projects." button="Discover all videos" />
        <ul className="hf-row hf-row-2">
          <li className="hf-wide"><Empty className="hf-fill" /><span className="hf-label">Video templates</span></li>
          <li className="hf-wide">
            <Link href="/motion" className="hf-wide-link" aria-label="Motion graphics"><Empty className="hf-fill" /><span className="hf-label">Motion graphics</span></Link>
          </li>
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
        <Head title="Tools to skyrocket your creative freedom" button="Discover all tools" />
        <ul className="hf-row hf-row-2">
          <li className="hf-tool">
            <Empty className="hf-fill" />
            <span className="hf-tool-title">Generate an image</span>
            <button type="button" className="hf-try" onClick={() => onGo("/create")}>Try it <ArrowRight size={15} /></button>
          </li>
          <li className="hf-tool">
            <Empty className="hf-fill" />
            <span className="hf-tool-title">Generate a video <SoonTag /></span>
            <button type="button" className="hf-try">Try it <ArrowRight size={15} /></button>
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
