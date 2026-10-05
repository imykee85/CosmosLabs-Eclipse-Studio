"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Award, Clapperboard, Coins, FolderOpen, Images, Layers, LayoutDashboard, LayoutGrid, Library, PenLine, Play, Settings, User, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import AgentIcon from "@/components/AgentIcon";
import { SignOutButton } from "@/components/account";
import UserMenu from "@/components/UserMenu";
import { LogoMark } from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { lessons, type Lesson } from "@/lib/tutorial";
import "@/components/app-theme.css";
import "@/components/dashboard/dashboard.css";
import "./tutorial.css";

// The back button wears the icon of the page it returns to (Dashboard uses the same icon as the menu).
const ORIGIN_ICONS: Record<string, LucideIcon | typeof AgentIcon> = {
  "/dashboard": LayoutDashboard, "/project": Clapperboard, "/create": PenLine, "/gallery": Images, "/library": Library,
  "/ingredients": Layers, "/agents": AgentIcon, "/assets": FolderOpen, "/avatars": User, "/portfolio": LayoutGrid,
  "/certificates": Award, "/settings": Settings,
};

function Player({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector("button")?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", esc); };
  }, [onClose]);

  return (
    <div className="tu-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="tu-player" role="dialog" aria-modal="true" aria-label={lesson.title}>
        <button type="button" className="tu-x" aria-label="Close video" onClick={onClose}><X size={18} /></button>
        <video src={lesson.video} controls autoPlay playsInline />
        <p>{lesson.title}</p>
      </div>
    </div>
  );
}

export default function TutorialView({ back }: { back: { path: string; label: string } }) {
  const BackIcon = ORIGIN_ICONS[back.path] ?? LayoutDashboard;
  const [playing, setPlaying] = useState<Lesson | null>(null);

  return (
    <div className="db-page">
      <header className="db-header">
        <Link href="/" aria-label="Eclipse home" className="db-logo"><LogoMark size={48} /></Link>
        <div className="db-header-right">
          <Link href={back.path} className="db-pill"><BackIcon size={15} /> {back.label}</Link>
          <span className="db-pill db-pill-solid" title="Credits"><Coins size={14} /> 0</span>
          <ThemeToggle className="db-icon" />
          <SignOutButton className="db-icon" />
          <UserMenu />
        </div>
      </header>

      <main className="tu-main">
        <Link href={back.path} className="tu-close" aria-label={`Close tutorial and go back to ${back.label}`}><X size={16} /></Link>
        <h1>Eclipse tutorial</h1>
        <p className="tu-lead">
          Three short lessons on getting from an idea to a finished image. Watch them in order, or jump straight to the one you need.
        </p>

        <ul className="tu-grid">
          {lessons.map((l, i) => (
            <li key={l.title} className="tu-card">
              <span className="tu-tag">{i + 1} · LESSON</span>
              <h2>{l.title}</h2>
              <div className={`tu-thumb tone-${i}`} aria-hidden="true">
                <span><Play size={22} fill="currentColor" /></span>
              </div>
              <button type="button" className="tu-watch" disabled={!l.video} onClick={() => setPlaying(l)}>
                {l.video ? "Watch" : "Coming soon"}
              </button>
            </li>
          ))}
        </ul>
      </main>
      {playing && <Player lesson={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}
