"use client";

import { fmtCredits } from "@/lib/credit-units";
import { planSaving, planValue } from "@/lib/plan-copy";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SignedIn, SignedOut } from "@/components/auth";
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronUp, Menu, Play, Plus, Lightbulb, X } from "lucide-react";
import { audience, faqs, results } from "./data";
import { plans } from "@/lib/plans";
import PriceBadge from "@/components/i18n/PriceBadge";
import PlanBenefits from "@/components/PlanBenefits";
import LanguageMenu from "@/components/i18n/LanguageMenu";
import HeroImage from "./HeroImage";
import NavFit from "./NavFit";
import CanvasCarousel from "./CanvasCarousel";
import AtlasWorkflow from "./AtlasWorkflow";
import AtlasOrbitSection from "./AtlasOrbitSection";
import CtaPromptCard from "./CtaPromptCard";
import ScrollReveal from "./ScrollReveal";
import StudioFlow from "./StudioFlow";
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

// A muted, looping clip on a model card. Phones only start a video once its muted attribute exists in the HTML, so it is set on the element itself.
const CARD_VIDEO: Record<string, { src: string; webm: string; poster: string }> = {
  "ADVERTISEMENT": { src: "/landing/wan-card.mp4", webm: "/landing/wan-card.webm", poster: "/landing/wan-card-poster.jpg" },
  "FILM MAKING": { src: "/landing/seedance-card.mp4", webm: "/landing/seedance-card.webm", poster: "/landing/seedance-card-poster.jpg" },
  "MUSIC VIDEOS": { src: "/landing/minimax-card.mp4", webm: "/landing/minimax-card.webm", poster: "/landing/minimax-card-poster.jpg" },
};

// The results wall tile that plays a clip (the owner's marked tile, the second in the second column).
const RESULT_VIDEO: Record<string, { src: string; webm: string; poster: string }> = {
  Food: { src: "/landing/food-tile.mp4", webm: "/landing/food-tile.webm", poster: "/landing/food-tile-poster.jpg" },
};

function CardVideo({ src, webm, poster }: { src: string; webm: string; poster: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    v.muted = true; v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    void v.play().catch(() => {});
  }, []);
  return (
    <video ref={ref} className="card-video" poster={poster} muted loop playsInline autoPlay preload="metadata" aria-hidden="true">
      <source src={src} type="video/mp4" />
      <source src={webm} type="video/webm" />
    </video>
  );
}

export default function Landing() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

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
        <NavFit />
        <HeroImage />
        <div className="hero-copy">
          <h1>Eclipse Studio</h1>
          <h2 className="hero-sub">AI Creative Suite</h2>
          <p className="hero-deck">
            Turn any idea into premium content, <br className="desktop-only" />
            from a single prompt to finished work, all in one place.
          </p>
          <Cta glint />
          <SignedOut><p className="hero-trial">Start free trial</p></SignedOut>
        </div>
        <IndustryStrip above={<a className="hero-why" href="#how-it-works"><Play size={16} fill="currentColor" strokeWidth={0} aria-hidden="true" />Why Eclipse?</a>} />
        <div className="scroll-cue"><ArrowDown size={16} /> scroll to explore</div>
      </section>

      <section id="examples" className="wow-section section-pad">
        <div className="section-kicker kicker-center"><span>One canvas.</span><span><em>Endless</em> possibilities.</span></div>
        <ScrollReveal className="wow-reveal" text="The only limit is the one you imagine. And you just stopped imagining it. Every idea you have ever had in your head is now one sentence away. No crew, no budget, no waiting. Just you, and everything you can create." />
        <CanvasCarousel />
        <div className="center-cta"><span>ALL CREATED WITH ECLIPSE.</span><Cta dark>Create Yours</Cta></div>
      </section>

      <section className="audience-section section-pad">
        <div className="section-heading-row">
          <div>
            <div className="eyebrow">MADE FOR YOUR NEXT IDEA</div>
            <h2>what do you want<br /><em>to create?</em></h2>
            <p className="audience-sub">Discover the frontier of generative AI at the cheapest prices.</p>
          </div>
        </div>
        <div className="audience-grid">
          {audience.map(([title, , , , facts], i) => (
            <div className="audience-item" key={title}>
              <button className="audience-card" onClick={() => router.push("/sign-up")}>
                {CARD_VIDEO[title] ? <CardVideo {...CARD_VIDEO[title]} /> : <div className={`tile tone-${i % 10}`} />}
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
        <div className="results-head">
          <div>
            <h2>Made to look <em>like you meant it.</em></h2>
            <p>From a rough thought to a finished visual. Every category, one prompt away.</p>
          </div>
        </div>
        {/* Four columns of tiles in different heights; the last row fades into the page under one button (after the owner's reference). */}
        <div className="results-wall">
          <div className="results-cols">
            {[0, 1, 2, 3].map((c) => (
              <div className="results-col" key={c}>
                {results.filter((_, i) => i % 4 === c).map((name, j) => (
                  <article key={name} className={`rt-${c}-${j}`} aria-label={name}>
                    {RESULT_VIDEO[name] ? <CardVideo {...RESULT_VIDEO[name]} /> : <div className={`tile tone-${(c + j * 4) % 10}`} />}
                  </article>
                ))}
              </div>
            ))}
          </div>
          <div className="results-fade" aria-hidden="true" />
          <div className="results-more"><Cta dark>Create Yours</Cta></div>
        </div>
      </section>

      <section className="try-section try-cta section-pad">
        <div className="try-inner"><div className="eyebrow sf-eyebrow">YOUR STUDIO IS WAITING</div></div>
        <StudioFlow />
        <div className="try-inner">
          <h2>start creating<br /><em>with Eclipse.</em></h2>
          <div className="section-cta"><Cta /></div>
        </div>
      </section>

      <AtlasOrbitSection />

      <section id="pricing" className="pricing-section section-pad">
        <div className="eyebrow">SIMPLE PRICING</div>
        <h2 className="plans-title">pick the plan<br /><em>that fits.</em></h2>
        <div className="plan-grid has-free">
          <article className="plan-card plan-free">
            <h3>Trial</h3>
            <p className="plan-price">$0</p>
            <ul>
              <li><Check size={15} /> Free trial credits</li>
              <li><Check size={15} /> Any image model</li>
              <li><Check size={15} /> Access to free tutorials</li>
            </ul>
            <SignedOut><Link className="pill-btn" href="/sign-up">Start free</Link></SignedOut>
            <SignedIn><Link className="pill-btn" href="/dashboard">Open Eclipse</Link></SignedIn>
          </article>
          {plans.map((p, i) => (
            <article className={`plan-card ${i === 1 ? "plan-popular" : ""}`} key={p.name}>
              {i === 1 && <span className="plan-tag">Most popular</span>}
              <h3>{p.name}{planSaving(p) > 0 && <span className="plan-save">Save {planSaving(p)}%</span>}</h3>
              <p className="plan-price">${p.price}<small>/month</small></p>
              <PriceBadge usd={p.price} className="badge-row" />
              <p className="plan-value">{planValue(p)}</p>
              <ul>
                <li><Check size={15} /> {fmtCredits(p.credits)} credits every month</li>
                <li><Check size={15} /> {p.seats} seat{p.seats === 1 ? "" : "s"}</li>
                </ul>
              <PlanBenefits planId={p.id as "starter" | "growth" | "scale"} />
              <SignedOut><Link className="pill-btn" href="/sign-up">Get started</Link></SignedOut>
              <SignedIn><Link className="pill-btn" href="/settings">Choose plan</Link></SignedIn>
            </article>
          ))}
        </div>
        <p className="plan-rule">Plan credits renew monthly and do not roll over. Top-up credits last 90 days and can be used while you are subscribed.</p>
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
        <div className="footer-bottom"><span className="footer-brand"><Logo className="footer-mark" size={40} /><span>© 2026 Cosmos Labs AI. All rights reserved.</span></span><div><a href="/terms">Terms of Use</a><a href="/privacy">Privacy Policy</a></div></div>
      </footer>
    </main>
  );
}
