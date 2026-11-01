"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, MoreVertical, Plus } from "lucide-react";
import ProtectMedia from "@/components/landing/ProtectMedia";
import { ClipCard } from "@/components/landing/ClipCard";
import "./home-feed.css";

// The lower half of the dashboard, laid out as a long home page: collections, video, looks, tools, questions.
// Cards with no real content behind them stay EMPTY placeholders on purpose (no pictures, no invented counts). Working: "Discover all videos" (/motion), "Discover all tools" (/tools), Generate an image and Generate
// a video (Image or Video Studio inside the latest project through `onGo`, or the New Project popup first).
const FAQ: [string, string][] = [
  ["What can I create?", "Images, videos, voices, sound effects and music."],
  ["Where do my creations go?", "Everything you make is saved to your private Library; images and videos also go to the Gallery of the project you made them in."],
  ["What is Core?", "Your creative computer: a chat that can make images, follow skills, remember your style and send finished work to apps such as Telegram, Slack, Discord, email, Notion or Linear."],
  ["Can I use my own pictures?", "Yes. Add them under Ingredients or Assets, then pick them as references in Image Studio when the model supports it."],
];

// A muted looping clip that always plays (see ClipCard: if the phone refuses autoplay, the MP4 plays as an image instead).
function LoopVideo({ src, webm, poster, className = "" }: { src: string; webm: string; poster: string; className?: string }) {
  return <ClipCard src={src} webm={webm} poster={poster} className={className} />;
}

const Empty = ({ className = "" }: { className?: string }) => <span className={`hf-empty ${className}`} />;

function Head({ title, sub, button, onButton }: { title: string; sub?: string; button?: string; onButton?: () => void }) {
  return (
    <>
      <h2>{title}</h2>
      {sub && <p className="hf-sub">{sub}</p>}
      {button && <button type="button" className="hf-pill" onClick={onButton}>{button}</button>}
    </>
  );
}

export default function HomeFeed({ onGo }: { onGo: (path: string) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="hf" aria-label="Home">
      <ProtectMedia rootSelector=".hf" />
      <div className="hf-sec">
        <button type="button" className="hf-pill">Explore collections</button>
        <ul className="hf-row">
          {["Art Direction", "Portraits", "Interiors", "Product shots", "Beauty shots"].map((n) => (
            <li key={n} className="hf-col">
              <div className="hf-quad">
                {n === "Art Direction" || n === "Portraits" || n === "Interiors"
                  ? [1, 2, 3, 4].map((i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} className="hf-pic" src={`/dashboard/${n === "Portraits" ? "portrait" : n === "Interiors" ? "interior" : "product"}-${i}.jpg`} alt="" loading="lazy" draggable={false} />
                  ))
                  : n === "Product shots"
                    ? [1, 2, 3, 4].map((i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} className="hf-pic" src={`/dashboard/productshot-${i}.jpg`} alt="" loading="lazy" draggable={false} />))
                    : n === "Beauty shots"
                      // The carousel's Portrait picture (the red glitter liner), cropped to the tile shape, is the first tile.
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <><img className="hf-pic" src="/dashboard/beauty-portrait.jpg" alt="" loading="lazy" draggable={false} /><Empty /><Empty /><Empty /></>
                      : <><Empty /><Empty /><Empty /><Empty /></>}
              </div>
              <div className="hf-col-meta"><b>{n}</b><MoreVertical size={16} aria-hidden="true" /></div>
            </li>
          ))}
        </ul>
      </div>

      <div className="hf-sec">
        <Head title="A video library for every idea" sub="Find footage, templates and motion to power up your projects." button="Discover all videos" onButton={() => onGo("/motion")} />
        <ul className="hf-row hf-row-2">
          <li className="hf-wide">
            <Link href="/motion" className="hf-wide-link" aria-label="Motion graphics"><LoopVideo className="hf-fill hf-video" src="/dashboard/motion-card.mp4" webm="/dashboard/motion-card.webm" poster="/dashboard/motion-card-poster.jpg" /><span className="hf-label hf-label-on-video">Motion graphics</span></Link>
          </li>
          <li className="hf-wide">
            <div className="hf-wide-link"><LoopVideo className="hf-fill hf-video" src="/dashboard/templates-card.mp4" webm="/dashboard/templates-card.webm" poster="/dashboard/templates-card-poster.jpg" /><span className="hf-label hf-label-on-video">Filmmaking</span></div>
          </li>
          <li className="hf-wide">
            <div className="hf-wide-link"><div className="hf-collage">{[1, 2, 3].map((n) => (<div key={n} className="hf-cell"><LoopVideo className="hf-video" src={`/landing/influencer-${n}.mp4`} webm={`/landing/influencer-${n}.webm`} poster={`/landing/influencer-${n}-poster.jpg`} /></div>))}</div><span className="hf-label hf-label-on-video">Influencer Marketing</span></div>
          </li>
        </ul>
      </div>

      <div className="hf-sec">
        <Head title="Looks for every style" sub="Browse photo, product and illustration looks for all your creative needs." button="Discover all looks" />
        <ul className="hf-row hf-row-2">
          {["Photography", "Illustration"].map((n) => (
            <li key={n} className="hf-looks">
              <b>{n}</b>
              <div className="hf-dots">{Array.from({ length: 9 }, (_, i) => (n === "Photography" ? [1, 3, 4, 5, 7] : [0, 2, 4, 7]).includes(i)
                // eslint-disable-next-line @next/next/no-img-element
                ? <img key={i} className="hf-dot hf-pic" src={`/dashboard/look-${n.toLowerCase()}-${i + 1}.jpg`} style={i === 1 ? { objectPosition: "50% 38%" } : undefined} alt="" loading="lazy" draggable={false} />
                : <Empty key={i} className="hf-dot" />)}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="hf-sec">
        <Head title="Tools to skyrocket your creative freedom" button="Discover all tools" onButton={() => onGo("/tools")} />
        <ul className="hf-row hf-row-2">
          <li className="hf-tool">
            <img className="hf-fill hf-tool-pic" src="/dashboard/tools-image.jpg" alt="" loading="lazy" draggable={false} />
            <span className="hf-tool-title">Generate an image</span>
            <button type="button" className="hf-try" onClick={() => onGo("/create")}>Try it <ArrowRight size={15} /></button>
          </li>
          <li className="hf-tool hf-tool-video">
            <LoopVideo className="hf-fill hf-video" src="/dashboard/generate-card.mp4" webm="/dashboard/generate-card.webm" poster="/dashboard/generate-card-poster.jpg" />
            <span className="hf-tool-title">Generate a video</span>
            <button type="button" className="hf-try" onClick={() => onGo("/generate")}>Try it <ArrowRight size={15} /></button>
          </li>
          <li className="hf-tool">
            <img className="hf-fill hf-tool-pic" src="/dashboard/agentic-image.jpg" alt="" loading="lazy" draggable={false} />
            <span className="hf-tool-title">Agentic Assistance</span>
            <button type="button" className="hf-try" onClick={() => onGo("/connect")}>Try it <ArrowRight size={15} /></button>
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
