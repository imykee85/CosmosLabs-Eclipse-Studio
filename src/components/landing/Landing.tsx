"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SignedIn, SignedOut } from "@/components/auth";
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronUp, Menu, Plus, Lightbulb, X } from "lucide-react";
import { audience, faqs, results } from "./data";
import { plans } from "@/lib/plans";
import PriceBadge from "@/components/i18n/PriceBadge";
import LanguageMenu from "@/components/i18n/LanguageMenu";
import HeroImage from "./HeroImage";
import CanvasCarousel from "./CanvasCarousel";
import AtlasWorkflow from "./AtlasWorkflow";
import AtlasOrbitSection from "./AtlasOrbitSection";
import CtaPromptCard from "./CtaPromptCard";
import ScrollReveal from "./ScrollReveal";
import IndustryStrip from "./IndustryStrip";
import Logo from "@/components/Logo";
import "@/app/landing.css";

function Cta({ dark = false, glint = false, children = "Start Creating" }: { dark?: boolean; glint?: boolean; children?: React.ReactNode }) {
  const cls = `pill-btn ${dark ? "pill-btn-dark" : ""} ${glint ? "glint-btn" : ""}`;
  return (
    <>
      <SignedOut>
        <Link className={cls} href="/sign-up">
          {children}
          <ArrowRight size={15} strokeWidth={1.7} />
        </Link>
      </SignedOut>
      <SignedIn>
        <Link className={cls} href="/create">
          Open Studio
          <ArrowRight size={15} strokeWidth={1.7} />
        </Link>
      </SignedIn>
    </>
  );
}

function Wordmark() {
  return <Logo className="wordmark" size={60} />;
}

export default function Landing() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [selected, setSelected] = useState(0);

  const close = () => setMobileOpen(false);

  return (
    <main className="site-shell">
      <header className="nav-wrap">
        <Wordmark />
        <nav className={mobileOpen ? "nav-links mobile-visible" : "nav-links"}>
          <LanguageMenu nav />
          <a href="#how-it-works" onClick={close}>How it Works</a>
          <a href="#pricing" onClick={close}>Pricing</a>
          <a href="#faq" onClick={close}>FAQ</a>
        </nav>
        <div className="nav-actions">
          <SignedOut>
            <Link className="pill-btn" href="/sign-in">
              Sign Up/Log In
              <ArrowRight size={15} strokeWidth={1.7} />
            </Link>
          </SignedOut>
          <SignedIn>
            <Link className="pill-btn" href="/create">
              Open Studio
              <ArrowRight size={15} strokeWidth={1.7} />
            </Link>
          </SignedIn>
          <button className="menu-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <section id="top" className="hero section-pad">
        <HeroImage />
        <div className="hero-copy">
          <h1>Eclipse Studio</h1>
          <h2 className="hero-sub">AI Creative Suite</h2>
          <p className="hero-deck">
            Turn any idea into premium content, <br className="desktop-only" />
            from a single prompt to finished work, all in one place.
          </p>
          <Cta glint />
        </div>
        <IndustryStrip />
        <div className="scroll-cue"><ArrowDown size={16} /> scroll to explore</div>
      </section>

      <section id="examples" className="wow-section section-pad">
        <div className="section-kicker kicker-center"><span>One canvas.</span><span><em>Endless</em> possibilities.</span></div>
        <ScrollReveal className="wow-reveal" text="Eclipse is the studio where ideas become finished work. Plan with Atlas, create images, video and voice with the world's best models, and keep it all in one place that is yours." />
        <CanvasCarousel />
        <div className="center-cta"><span>ALL CREATED WITH ECLIPSE.</span><Cta dark>Create Yours</Cta></div>
      </section>

      <section className="audience-section section-pad">
        <div className="section-heading-row">
          <div>
            <div className="eyebrow">MADE FOR YOUR NEXT IDEA</div>
            <h2>what do you want<br /><em>to create?</em></h2>
            <p className="audience-sub">Discover the latest frontier generative AI models.</p>
          </div>
        </div>
        <div className="audience-grid">
          {audience.map(([title, , , , facts], i) => (
            <div className="audience-item" key={title}>
              <button className={`audience-card ${selected === i ? "selected" : ""}`} onClick={() => setSelected(i)}>
                <div className={`tile tone-${i % 10}`} />
                <span className="audience-number">0{i + 1}</span>
                <div><b>{title}</b></div>
                <ArrowRight className="audience-arrow" size={18} />
              </button>
              <div className="audience-info"><p>{facts}</p></div>
            </div>
          ))}
        </div>
        <div className="section-cta"><Cta /></div>
      </section>

      <AtlasWorkflow cta={<Cta dark>Create your first piece</Cta>} />

      <CtaPromptCard
        id="try-it"
        eyebrow="TURN A THOUGHT INTO A STARTING POINT"
        line1="have an idea?" line2="try it."
        placeholder={"What do you want to create?\n\nDescribe your idea…"}
        button="Create my idea" icon={<Lightbulb size={17} />}
        onSubmit={(t) => router.push(t.trim() ? `/create?prompt=${encodeURIComponent(t.trim())}` : "/create")}
      />

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
              <div className={`tile tone-${i % 10}`} />
              <span>{name} <ArrowRight size={13} /></span>
            </article>
          ))}
        </div>
        <div className="center-cta" style={{ marginTop: 70 }}><Cta dark>Create Yours</Cta></div>
      </section>

      <section className="try-section try-cta section-pad">
        <div className="try-inner">
          <div className="eyebrow">YOUR STUDIO IS WAITING</div>
          <h2>start creating<br /><em>with Eclipse.</em></h2>
          <div className="section-cta"><Cta /></div>
        </div>
      </section>

      <AtlasOrbitSection />

      <section id="pricing" className="pricing-section section-pad">
        <div className="eyebrow">SIMPLE PRICING</div>
        <h2 className="plans-title">pick the plan<br /><em>that fits.</em></h2>
        <div className="plan-grid">
          {plans.map((p, i) => (
            <article className={`plan-card ${i === 1 ? "plan-popular" : ""}`} key={p.name}>
              {i === 1 && <span className="plan-tag">Most popular</span>}
              <h3>{p.name}</h3>
              <p className="plan-price">${p.price}<small>/month</small></p>
              <PriceBadge usd={p.price} className="badge-row" />
              <ul>
                <li><Check size={15} /> {p.credits.toLocaleString("en-US")} credits every month</li>
                <li><Check size={15} /> {p.seats} seat{p.seats === 1 ? "" : "s"}</li>
                <li><Check size={15} /> Private gallery for every project</li>
              </ul>
              <SignedOut><Link className="pill-btn" href="/sign-up">Get started</Link></SignedOut>
              <SignedIn><Link className="pill-btn" href="/settings">Choose plan</Link></SignedIn>
            </article>
          ))}
        </div>
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
        <button className="pill-btn" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          Back To Top
          <ArrowUp size={15} strokeWidth={1.7} />
        </button>
      </section>

      <footer id="footer" className="footer">
        <div className="footer-top">
          <Wordmark />
        </div>
        <div className="footer-bottom"><span>© 2026 Cosmos Labs AI. All rights reserved.</span><div><a href="/terms">Terms of Use</a><a href="/privacy">Privacy Policy</a></div></div>
      </footer>
    </main>
  );
}
