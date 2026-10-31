"use client";

import ProtectMedia from "./ProtectMedia";
import { ClipCard, playOnFirstGesture, type ClipMode } from "./ClipCard";
import { fmtCredits } from "@/lib/credit-units";
import { planSaving, planValue } from "@/lib/plan-copy";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
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

// Model cards that show several clips side by side (a collage of the owner's three clips).
const CARD_COLLAGE: Record<string, { src: string; webm: string; poster: string }[]> = {
  "AI INFLUENCERS": [1, 2, 3].map((n) => ({ src: `/landing/influencer-${n}.mp4`, webm: `/landing/influencer-${n}.webm`, poster: `/landing/influencer-${n}-poster.jpg` })),
};

// Model cards that show a picture instead of a clip.
const CARD_IMAGE: Record<string, string[]> = {
  "PRODUCT PHOTOGRAPHY": ["/landing/product-card.jpg", "/landing/product-card-2.jpg", "/landing/product-card-3.jpg"],
  "LOOK BOOK": ["/landing/lookbook-1.jpg", "/landing/lookbook-2.jpg"],
};

// The three-clip collage: one play button for all three clips. Until they play, the card shows the three posters (pictures, so no
// phone draws its own play button on each clip). The clips load and play together when autoplay works, or when the one button is pressed.
function CardCollage({ clips }: { clips: { src: string; webm: string; poster: string }[] }) {
  // Like ClipCard: the three videos stay on the page; if the phone refuses autoplay, the posters show with one button and the
  // clips start on the visitor's first tap anywhere.
  const [mode, setMode] = useState<ClipMode>("video");
  const refs = useRef<(HTMLVideoElement | null)[]>([]);
  const vids = () => refs.current.filter((v): v is HTMLVideoElement => !!v);
  useEffect(() => {
    const list = vids();
    if (!list.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    list.forEach((v) => { v.muted = true; v.defaultMuted = true; v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); });
    let stop = () => {};
    let alive = true;
    // The three clips are one picture: if any of them is refused (iPhone Low Power Mode), all three stop and show their posters with one button.
    Promise.all(list.map((v) => v.play().then(() => true, () => false))).then((ok) => {
      if (ok.every(Boolean) || !alive) return;
      list.forEach((v) => v.pause());
      setMode("still");
      stop = playOnFirstGesture(vids, () => setMode("video"));
    });
    return () => { alive = false; stop(); };
  }, []);
  const tap = (e: React.MouseEvent) => {
    e.stopPropagation();
    const list = vids();
    if (!list.length) return;
    list[0].play().then(() => { list.slice(1).forEach((v) => { void v.play().catch(() => {}); }); setMode("video"); }).catch(() => {});
  };
  const still = mode === "still";
  return (
    <div className={`card-collage${still ? " is-still" : ""}`}>
      {clips.map((c, i) => (
        <div key={c.src}>
          <video ref={(el) => { refs.current[i] = el; }} className="card-video" poster={c.poster} muted loop playsInline autoPlay preload="metadata" disablePictureInPicture controlsList="nodownload noremoteplayback" aria-hidden="true" style={still ? { display: "none" } : undefined}>
            <source src={c.src} type="video/mp4" />
            <source src={c.webm} type="video/webm" />
          </video>
          {still && <img src={c.poster} alt="" />}
        </div>
      ))}
      {still && <button type="button" className="clip-play" aria-label="Play" onClick={tap}><Play size={14} fill="currentColor" /></button>}
    </div>
  );
}

// Pictures that change on their own every few seconds (a crossfade). Under reduced motion only the first picture shows.
function CardSlides({ srcs, mode }: { srcs: string[]; mode: "fade" | "slide" }) {
  const [s, setS] = useState({ index: 0, prev: -1 });
  useEffect(() => {
    if (srcs.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setS((c) => ({ index: (c.index + 1) % srcs.length, prev: c.index })), 3500);
    return () => window.clearInterval(t);
  }, [srcs.length]);
  return (
    <div className={`card-slides${mode === "slide" ? " is-slide" : ""}`}>
      {srcs.map((src, i) => (
        <img key={src} className={`card-slide${i === s.index ? " is-on" : i === s.prev ? " is-prev" : ""}`} src={src} alt="" />
      ))}
    </div>
  );
}

// Results wall tiles that show a picture, by their place on the wall ("column-row", both counted from 0).
const SLOT_IMAGE: Record<string, string> = {
  "3-0": "/landing/results-fashion.jpg",
  "1-3": "/landing/results-jackets.jpg",
  "1-2": "/landing/results-product.jpg",
  "2-1": "/landing/results-earring.jpg",
  "1-0": "/landing/results-suit.jpg",
  "0-1": "/landing/results-bags.jpg",
  "3-1": "/landing/results-entertainment.jpg",
  "3-3": "/landing/results-interior-design.jpg",
};

// The results wall tile that plays a clip (the owner's marked tile, the second in the second column).
const RESULT_VIDEO: Record<string, { src: string; webm: string; poster: string }> = {
  Food: { src: "/landing/food-tile.mp4", webm: "/landing/food-tile.webm", poster: "/landing/food-tile-poster.jpg" },
};

// Wide (16:9) cards added under a wall tile, by that tile's slot ("column-row"); the value is the gradient tone.
const WIDE_AFTER: Record<string, number> = { "1-0": 3, "2-2": 7 };
// A wide card that shows a picture instead of its gradient, by the same slot key.
const WIDE_IMAGE: Record<string, string> = { "2-2": "/landing/results-flowers.jpg", "1-0": "/landing/results-orb.jpg" };

// A clip placed on the wall by slot.
const SLOT_VIDEO: Record<string, { src: string; webm: string; poster: string }> = {
  "3-2": { src: "/landing/results-video.mp4", webm: "/landing/results-video.webm", poster: "/landing/results-video-poster.jpg" },
  "0-0": { src: "/landing/results-clip4.mp4", webm: "/landing/results-clip4.webm", poster: "/landing/results-clip4-poster.jpg" },
  "2-2": { src: "/landing/results-clip3.mp4", webm: "/landing/results-clip3.webm", poster: "/landing/results-clip3-poster.jpg" },
  "2-3": { src: "/landing/results-clip2.mp4", webm: "/landing/results-clip2.webm", poster: "/landing/results-clip2-poster.jpg" },
  "2-0": { src: "/landing/results-clip5.mp4", webm: "/landing/results-clip5.webm", poster: "/landing/results-clip5-poster.jpg" },
  "0-2": { src: "/landing/real-estate-card.mp4", webm: "/landing/real-estate-card.webm", poster: "/landing/real-estate-card-poster.jpg" },
};

// Labels on the results wall, by slot ("column-row"); the key with "w" is the wide card under that tile. Tiles without a label have none.
const SLOT_LABEL: Record<string, string> = {
  "0-0": "AI Influencer",
  "1-0": "Fashion",
  "1-0w": "Design",
  "1-3": "Campaign",
  "1-2": "Product",
  "2-1": "Jewelry",
  "2-2": "Advertising",
  "3-0": "Social Media",
  "3-2": "Advertising",
  "0-1": "Product",
  "0-2": "Interior design",
  "1-1": "Advertising",
  "2-0": "Travel",
  "2-2w": "Film",
  "2-3": "Jewelry",
  "3-1": "Entertainment",
  "3-3": "Interior design",
};

function CardVideo({ src, webm, poster }: { src: string; webm: string; poster: string }) {
  return <ClipCard src={src} webm={webm} poster={poster} className="card-video" />;
}

export default function Landing() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  const close = () => setMobileOpen(false);
  // In-page links scroll without writing #section into the address, so a reload starts at the hero.
  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    close();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };
  // A reload (or a #section left in the address) always starts at the hero, not where the browser last was.
  useEffect(() => {
    const prev = history.scrollRestoration;
    history.scrollRestoration = "manual";
    if (window.location.hash) history.replaceState(null, "", window.location.pathname + window.location.search);
    window.scrollTo(0, 0);
    return () => { history.scrollRestoration = prev; };
  }, []);

  return (
    <main className="site-shell">
      <ProtectMedia />
      <header className="nav-wrap">
        <Wordmark />
        <nav className={mobileOpen ? "nav-links mobile-visible" : "nav-links"}>
          <LanguageMenu nav />
          <a href="#how-it-works" onClick={go("how-it-works")}>How it Works</a>
          <a href="#pricing" onClick={go("pricing")}>Pricing</a>
          <a href="#faq" onClick={go("faq")}>FAQ</a>
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
        <IndustryStrip above={<Link className="hero-why" href="/about"><Play size={16} fill="currentColor" strokeWidth={0} aria-hidden="true" />Why Eclipse?</Link>} />
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
              <div className="audience-card">
                {CARD_COLLAGE[title] ? <CardCollage clips={CARD_COLLAGE[title]} /> : CARD_VIDEO[title] ? <CardVideo {...CARD_VIDEO[title]} /> : CARD_IMAGE[title] ? <CardSlides srcs={CARD_IMAGE[title]} mode={title === "LOOK BOOK" ? "slide" : "fade"} /> : <div className={`tile tone-${i % 10}`} />}
                <span className="audience-number">0{i + 1}</span>
                <div><b>{title}</b></div>
                <ArrowRight className="audience-arrow" size={18} />
              </div>
              <div className="audience-info"><p>{facts}</p></div>
            </div>
          ))}
        </div>
        <div className="section-cta audience-cta"><div className="center-cta"><span>ALL CREATED WITH ECLIPSE.</span><Cta /></div></div>
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
                  <Fragment key={name}>
                  <article className={`rt-${c}-${j}`} aria-label={name}>
                    {SLOT_IMAGE[`${c}-${j}`] ? <img src={SLOT_IMAGE[`${c}-${j}`]} alt="" /> : SLOT_VIDEO[`${c}-${j}`] ? <CardVideo {...SLOT_VIDEO[`${c}-${j}`]} /> : RESULT_VIDEO[name] ? <CardVideo {...RESULT_VIDEO[name]} /> : <div className={`tile tone-${(c + j * 4) % 10}`} />}
                    {SLOT_LABEL[`${c}-${j}`] && <span className="rt-label">{SLOT_LABEL[`${c}-${j}`]}</span>}
                  </article>
                  {WIDE_AFTER[`${c}-${j}`] != null && <article className="rt-wide" aria-hidden="true">{WIDE_IMAGE[`${c}-${j}`] ? <img src={WIDE_IMAGE[`${c}-${j}`]} alt="" /> : <div className={`tile tone-${WIDE_AFTER[`${c}-${j}`]}`} />}{SLOT_LABEL[`${c}-${j}w`] && <span className="rt-label">{SLOT_LABEL[`${c}-${j}w`]}</span>}</article>}
                  </Fragment>
                ))}
                {/* One more card under every column so each runs past the bottom edge of the wall and no gap shows. */}
                <article className="rt-fill" aria-hidden="true"><div className={`tile tone-${(c * 3 + 1) % 10}`} /></article>
              </div>
            ))}
          </div>
          <div className="results-fade" aria-hidden="true" />
        </div>
        <div className="results-more"><div className="center-cta"><span>ALL CREATED WITH ECLIPSE.</span><Cta dark>Create Yours</Cta></div></div>
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
              <li><Check size={15} /> No card needed</li>
              <li><Check size={15} /> Any image model, premium ones too</li>
              <li><Check size={15} /> Full quality, no watermark</li>
              <li><Check size={15} /> Download and share your work</li>
              <li><Check size={15} /> Access to free tutorials</li>
              <li><Check size={15} /> Build your portfolio draft</li>
              <li><Check size={15} /> Everything you make stays yours</li>
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
