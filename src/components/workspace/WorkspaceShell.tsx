"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Bot, ChevronDown, Coins, FolderOpen, GraduationCap, House, Images, Layers, LayoutDashboard, Menu, PanelLeft, PenLine, Settings, X,
} from "lucide-react";
import { AccountName, SignOutButton } from "@/components/account";
import Avatar from "@/components/Avatar";
import ThemeToggle from "@/components/ThemeToggle";
import "@/components/app-theme.css";
import { readCurrentProjectName } from "@/lib/projects";
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

const TITLES: Record<string, string> = {
  "/project": "Studio", "/create": "Create", "/gallery": "Gallery", "/ingredients": "Ingredients", "/agents": "Agents", "/settings": "Settings",
};

export default function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [project, setProject] = useState("");
  const [drawer, setDrawer] = useState(false);

  useEffect(() => setProject(readCurrentProjectName()), [pathname]);

  // Phone menu: closes after navigating, and the page behind it does not scroll while it is open.
  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = drawer ? "hidden" : previous;
    return () => { document.body.style.overflow = previous; };
  }, [drawer]);

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
          {(name, image) => (
            <Link href="/settings" className={`ws-account ${pathname === "/settings" ? "is-active" : ""}`} title="Settings">
              <Avatar name={name} image={image} className="ws-avatar" />
              <span><b>{name}</b><small>Trial plan</small></span>
              <Settings size={16} className="ws-account-gear" aria-hidden="true" />
            </Link>
          )}
        </AccountName>
      </aside>

      <div className="ws-content">
        <header className="ws-topbar">
          {!open && <button className="ws-icon-btn" aria-label="Open sidebar" onClick={() => setOpen(true)}><PanelLeft size={16} /></button>}
          <Link href="/dashboard" className="ws-back"><ArrowLeft size={15} /> Dashboard</Link>
          {project && <span className="ws-project" title="Current project">{project}</span>}
          <div className="ws-topbar-right">
            <Link href="/#how-it-works" className="ws-pill"><GraduationCap size={15} /> Tutorial</Link>
            <span className="ws-pill ws-pill-solid" title="Credits"><Coins size={14} /> 0</span>
            <ThemeToggle className="ws-icon-btn" />
            <SignOutButton className="ws-icon-btn" />
          </div>
        </header>
        <header className="mb-top">
          <button className="mb-icon" aria-label="Open menu" onClick={() => setDrawer(true)}><Menu size={22} /></button>
          <h1 className="mb-title">{TITLES[pathname] ?? "Studio"}</h1>
          <AccountName>
            {(name, image) => <button className="mb-avatar" aria-label="Open menu" onClick={() => setDrawer(true)}><Avatar name={name} image={image} className="mb-avatar-in" /></button>}
          </AccountName>
        </header>
        <main className="ws-main">{children}</main>
      </div>

      <nav className="mb-tabs" aria-label="Main">
        <Link href="/dashboard" className="mb-tab"><span className="mb-tab-icon"><House size={21} /></span><span>Home</span></Link>
        <Link href="/create" className={`mb-tab ${pathname === "/create" ? "is-active" : ""}`}><span className="mb-tab-icon"><PenLine size={21} /></span><span>Create</span></Link>
        <Link href="/gallery" className={`mb-tab ${pathname === "/gallery" ? "is-active" : ""}`}><span className="mb-tab-icon"><Images size={21} /></span><span>Gallery</span></Link>
        <Link href="/settings" className={`mb-tab ${pathname === "/settings" ? "is-active" : ""}`}><span className="mb-tab-icon"><Settings size={21} /></span><span>Settings</span></Link>
      </nav>

      <div className={`mb-drawer ${drawer ? "is-open" : ""}`} aria-hidden={!drawer}>
        <button className="mb-scrim" aria-label="Close menu" tabIndex={drawer ? 0 : -1} onClick={() => setDrawer(false)} />
        <aside className="mb-panel" aria-label="Menu">
          <AccountName>
            {(name, image) => (
              <div className="mb-profile">
                <Avatar name={name} image={image} className="ws-avatar" />
                <span><b>{name}</b><small>Trial plan</small></span>
                <button className="mb-icon" aria-label="Close menu" onClick={() => setDrawer(false)}><X size={20} /></button>
              </div>
            )}
          </AccountName>
          <nav className="mb-nav">
            <NavItem item={ingredients} pathname={pathname} />
            <NavItem item={agentsItem} pathname={pathname} />
            <Section title="PHOTO" items={photo} pathname={pathname} />
            <Section title="VIDEO" items={video} pathname={pathname} />
          </nav>
          <div className="mb-foot">
            <Link href="/dashboard" className="mb-foot-link"><LayoutDashboard size={19} /> Dashboard</Link>
            <Link href="/settings" className="mb-foot-link"><Settings size={19} /> Settings</Link>
            <Link href="/#how-it-works" className="mb-foot-link"><GraduationCap size={19} /> Tutorial</Link>
            <div className="mb-foot-row">
              <span className="mb-credits"><Coins size={15} /> 0 credits</span>
              <ThemeToggle className="ws-icon-btn" />
              <SignOutButton className="ws-icon-btn" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

