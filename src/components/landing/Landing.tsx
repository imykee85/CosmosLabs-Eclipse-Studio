"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SignedIn, SignedOut } from "@/components/auth";
import { ArrowDown, ArrowRight, Check, ChevronUp, Menu, Plus, Sparkles, X } from "lucide-react";
import { audience, faqs, heroTiles, results, steps, wowTiles } from "./data";
import "@/app/landing.css";

function Cta({ dark = false, children = "Start Creating" }: { dark?: boolean; children?: React.ReactNode }) {
  return (
    <>
      <SignedOut>
        <Link className={`pill-btn ${dark ? "pill-btn-dark" : ""}`} href="/sign-up">
          {children}
          <ArrowRight size={15} strokeWidth={1.7} />
        </Link>
      </SignedOut>
      <SignedIn>
        <Link className={`pill-btn ${dark ? "pill-btn-dark" : ""}`} href="/create">
          Open Studio
          <ArrowRight size={15} strokeWidth={1.7} />
        </Link>
      </SignedIn>
    </>
  );
}

function Wordmark() {
  return (
    <Link className="wordmark" href="/" aria-label="Eclipse home">
      <span className="wordmark-mark">e</span>clipse
    </Link>
  );
}

export default function Landing() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [idea, setIdea] = useState("");
  const [openFaq, setOpenFaq] = useState(0);
  const [selected, setSelected] = useState(0);

  const close = () => setMobileOpen(false);
  const tryIt = () => router.push(idea.trim() ? `/create?prompt=${encodeURIComponent(idea.trim())}` : "/create");

  return (
    <main className="site-shell">
      <header className="nav-wrap">
        <Wordmark />
        <nav className={mobileOpen ? "nav-links mobile-visible" : "nav-links"}>
          <a href="#examples" onClick={close}>Examples</a>
          <a href="#how-it-works" onClick={close}>How it Works</a>
          <a href="#faq" onClick={close}>FAQ</a>
          <SignedOut>
            <Link className="mobile-login" href="/sign-in">Log in</Link>
          </SignedOut>
        </nav>
        <div className="nav-actions">
          <SignedOut>
            <Link className="login" href="/sign-in">Log in</Link>
          </SignedOut>
          <Cta />
          <button className="menu-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <section id="top" className="hero section-pad">
        <div className="hero-copy">
          <div className="eyebrow">BY COSMOS LABS AI</div>
          <h1>your creative studio<span>.</span></h1>
          <p className="hero-deck">
            Turn any idea into premium images — <br className="desktop-only" />
            from a single prompt to finished content, all in one place.
          </p>
          <p className="hero-note">No team. No prompting skills. No complicated tools.</p>
          <Cta />
        </div>
        <div className="hero-mosaic" aria-label="Examples of generated content">
          {heroTiles.map((t, i) => (
            <figure className={`hero-tile ${t.cls}`} key={t.label}>
              <figcaption><span>{t.label}</span><ArrowRight size={12} /><span>{t.result}</span></figcaption>
              <div className={`tile tone-${i}`} role="img" aria-label={`${t.label} to ${t.result}`} />
            </figure>
          ))}
        </div>
        <div className="scroll-cue"><ArrowDown size={16} /> scroll to explore</div>
      </section>

      <section id="examples" className="wow-section section-pad">
        <div className="section-kicker">ONE PROMPT. <em>ENDLESS</em> POSSIBILITIES.</div>
        <div className="wow-grid">
          {wowTiles.map(([title, sub], i) => (
            <article className={`wow-card wow-${i + 1}`} key={title}>
              <div className={`tile tone-${i}`} />
              <div className="image-wash" />
              <div className="wow-label"><b>{title}</b><span>{sub}</span></div>
            </article>
          ))}
        </div>
        <div className="center-cta"><span>ALL CREATED WITH ECLIPSE.</span><Cta dark>Create Yours</Cta></div>
      </section>

      <section className="audience-section section-pad">
        <div className="section-heading-row">
          <div>
            <div className="eyebrow">MADE FOR YOUR NEXT IDEA</div>
            <h2>what do you want<br /><em>to create?</em></h2>
          </div>
          <div className="audience-preview">
            <div className={`tile tone-${selected}`} />
            <div><b>{audience[selected][0]}</b><p>{audience[selected][1]}</p></div>
          </div>
        </div>
        <div className="audience-grid">
          {audience.map(([title, copy], i) => (
            <button className={`audience-card ${selected === i ? "selected" : ""}`} onClick={() => setSelected(i)} key={title}>
              <div className={`tile tone-${i}`} />
              <span className="audience-number">0{i + 1}</span>
              <div><b>{title}</b><small>{copy}</small></div>
              <ArrowRight className="audience-arrow" size={18} />
            </button>
          ))}
        </div>
        <div className="section-cta"><Cta /></div>
      </section>

      <section id="how-it-works" className="process-section section-pad">
        <div className="process-title">
          <div className="eyebrow">THE ECLIPSE WORKFLOW</div>
          <h2>from idea to image.<br /><em>in one step.</em></h2>
          <Cta dark>Create your first image</Cta>
        </div>
        <div className="process-list">
          {steps.map(([num, title, copy]) => (
            <div className="process-row" key={num}>
              <span>{num}</span>
              <div><b>{title}</b><p>{copy}</p></div>
              <ArrowRight size={18} />
            </div>
          ))}
        </div>
      </section>

      <section id="try-it" className="try-section section-pad">
        <div className="try-inner">
          <div className="eyebrow">TURN A THOUGHT INTO A STARTING POINT</div>
          <h2>have an idea?<br /><em>try it.</em></h2>
          <div className="idea-box">
            <textarea value={idea} onChange={(e) => setIdea(e.target.value)} placeholder={"What do you want to create?\n\nDescribe your idea…"} />
            <button className="create-btn" onClick={tryIt}><Sparkles size={17} /> Create my idea</button>
          </div>
          <p className="try-caption">No prompt engineering. No blank canvas. Just start with what you’re imagining.</p>
        </div>
      </section>

      <section className="results-section section-pad">
        <div className="section-heading-row results-heading">
          <div>
            <div className="eyebrow">CREATED WITH ECLIPSE</div>
            <h2>made to look<br /><em>like you meant it.</em></h2>
          </div>
          <p>From a rough thought to a finished visual. Every category, one prompt away.</p>
        </div>
        <div className="results-grid">
          {results.map((name, i) => (
            <article key={name}>
              <div className={`tile tone-${i}`} />
              <span>{name} <ArrowRight size={13} /></span>
            </article>
          ))}
        </div>
        <div className="center-cta" style={{ marginTop: 70 }}><Cta dark>Create Yours</Cta></div>
      </section>

      <section id="faq" className="faq-section section-pad">
        <div className="eyebrow">QUESTIONS, ANSWERED.</div>
        <h2>frequently asked<br /><em>questions</em></h2>
        <div className="faq-list">
          {faqs.map(([q, a], i) => (
            <div className={`faq-item ${openFaq === i ? "open" : ""}`} key={q}>
              <button onClick={() => setOpenFaq(openFaq === i ? -1 : i)}>
                <span>{q}</span>
                {openFaq === i ? <ChevronUp size={18} /> : <Plus size={18} />}
              </button>
              {openFaq === i && <p>{a}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="final-section section-pad">
        <div className="eyebrow">YOUR NEXT IDEA SHOULDN’T STAY AN IDEA</div>
        <h2>TURN IT INTO<br /><em>CONTENT WITH ECLIPSE.</em></h2>
        <Cta />
      </section>

      <footer id="footer" className="footer">
        <div className="footer-top">
          <Wordmark />
          <div className="footer-links">
            <a href="#examples">Examples</a>
            <a href="#how-it-works">How it Works</a>
            <a href="#faq">FAQ</a>
            <SignedOut><Link href="/sign-in">Log in</Link></SignedOut>
            <Cta />
          </div>
        </div>
        <div className="footer-bottom"><span>© 2026 Cosmos Labs AI. All rights reserved.</span></div>
      </footer>
    </main>
  );
}
