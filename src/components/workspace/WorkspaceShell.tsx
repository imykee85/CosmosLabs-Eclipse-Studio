"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Bot, ChevronDown, Coins, FolderOpen, GraduationCap, Images, Layers, PanelLeft, PenLine,
} from "lucide-react";
import { AccountName, SignOutButton } from "@/components/account";
import "./workspace.css";

type Item = { label: string; hint: string; href?: string; icon?: React.ReactNode; step?: number };

const ingredients: Item = { label: "Ingredients", hint: "Character · Product · Scene", href: "/ingredients", icon: <Layers size={17} /> };
const photo: Item[] = [
  { label: "Create", hint: "Write a prompt", href: "/create", icon: <PenLine size={17} /> },
  { label: "Gallery", hint: "Finished renders", href: "/gallery", icon: <Images size={17} /> },
  { label: "Assets", hint: "Reference photos", icon: <FolderOpen size={17} /> },
];
const agentsItem: Item = { label: "Agents", hint: "Choose your agent", href: "/agents", icon: <Bot size={17} /> };
const video: Item[] = [
  { label: "Story", hint: "Plan the scenes", step: 1 },
  { label: "Prompts", hint: "Scene by scene", step: 2 },
  { label: "Generate", hint: "Render the clips", step: 3 },
  { label: "Export", hint: "Deliver and share", step: 4 },
];

function NavItem({ item, pathname }: { item: Item; pathname: string }) {
  const body = (
    <>
      {item.step ? <span className="ws-step">{item.step}</span> : <span className="ws-icon">{item.icon}</span>}
      <span className="ws-item-text">
        <b>{item.label}</b>
        <small>{item.hint}</small>
      </span>
      {!item.href && <em className="ws-soon">Soon</em>}
    </>
  );
  if (!item.href) return <div className="ws-item is-soon" aria-disabled="true">{body}</div>;
  return (
    <Link href={item.href} className={`ws-item ${pathname === item.href ? "is-active" : ""}`} aria-current={pathname === item.href ? "page" : undefined}>
      {body}
    </Link>
  );
}

function Section({ title, items, pathname }: { title: string; items: Item[]; pathname: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="ws-section">
      <button className="ws-section-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <ChevronDown size={13} className={open ? "" : "is-closed"} /> {title}
      </button>
      {open && items.map((i) => <NavItem key={i.label} item={i} pathname={pathname} />)}
    </div>
  );
}

export default function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  // Sidebar starts closed on small screens and closes after navigating there.
  useEffect(() => {
    if (window.matchMedia("(max-width: 800px)").matches) setOpen(false);
  }, [pathname]);

  return (
    <div className={`ws-root ${open ? "is-open" : ""}`}>
      <aside className="ws-sidebar" aria-label="Workflow">
        <div className="ws-sidebar-head">
          <span>WORKFLOW</span>
          <button className="ws-icon-btn" aria-label="Collapse sidebar" onClick={() => setOpen(false)}><PanelLeft size={16} /></button>
        </div>
        <nav className="ws-nav">
          <NavItem item={ingredients} pathname={pathname} />
          <NavItem item={agentsItem} pathname={pathname} />
          <Section title="PHOTO" items={photo} pathname={pathname} />
          <Section title="VIDEO" items={video} pathname={pathname} />
        </nav>
        <AccountName>
          {(name) => (
            <div className="ws-account">
              <span className="ws-avatar">{name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
              <span><b>{name}</b><small>Trial plan</small></span>
            </div>
          )}
        </AccountName>
      </aside>
      {open && <button className="ws-scrim" aria-label="Close sidebar" onClick={() => setOpen(false)} />}

      <div className="ws-content">
        <header className="ws-topbar">
          {!open && <button className="ws-icon-btn" aria-label="Open sidebar" onClick={() => setOpen(true)}><PanelLeft size={16} /></button>}
          <Link href="/dashboard" className="ws-back"><ArrowLeft size={15} /> back to dashboard</Link>
          <div className="ws-topbar-right">
            <Link href="/#how-it-works" className="ws-pill"><GraduationCap size={15} /> Tutorial</Link>
            <span className="ws-pill ws-pill-solid" title="Credits"><Coins size={14} /> 0</span>
            <SignOutButton className="ws-icon-btn" />
          </div>
        </header>
        <main className="ws-main">{children}</main>
      </div>
    </div>
  );
}

