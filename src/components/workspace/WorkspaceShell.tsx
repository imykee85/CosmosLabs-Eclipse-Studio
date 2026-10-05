"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cloneElement, isValidElement, useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import {
  ArrowLeft, Bot, ChevronDown, Coins, FolderOpen, GraduationCap, House, Images, Layers, LayoutDashboard, Library, Menu, PanelLeft, PenLine, Settings, X,
} from "lucide-react";
import { AccountName, SignOutButton } from "@/components/account";
import Avatar from "@/components/Avatar";
import UserMenu from "@/components/UserMenu";
import ThemeToggle from "@/components/ThemeToggle";
import "@/components/app-theme.css";
import { readCurrentProjectName } from "@/lib/projects";
import { tutorialHref } from "@/lib/tutorial";
import "./workspace.css";

type Item = { label: string; hint: string; href?: string; icon?: React.ReactNode; step?: number; soon?: boolean };

const ingredients: Item = { label: "Ingredients", hint: "Character · Product · Scene", href: "/ingredients", icon: <Layers size={17} /> };
const photo: Item[] = [
  { label: "Create", hint: "Write a prompt", href: "/create", icon: <PenLine size={17} /> },
  { label: "Gallery", hint: "Finished renders", href: "/gallery", icon: <Images size={17} /> },
  { label: "Assets", hint: "Reference photos", href: "/assets", soon: true, icon: <FolderOpen size={17} /> },
];
const agentsItem: Item = { label: "Agents", hint: "Choose your agent", href: "/agents", icon: <Bot size={17} /> };
const video: Item[] = [
  { label: "Story", hint: "Plan the scenes", step: 1 },
  { label: "Prompts", hint: "Scene by scene", step: 2 },
  { label: "Generate", hint: "Render the clips", step: 3 },
  { label: "Export", hint: "Deliver and share", step: 4 },
];

function NavItem({ item, pathname, onPick }: { item: Item; pathname: string; onPick?: (item: Item) => void }) {
  const body = (
    <>
      {item.step ? <span className="ws-step">{item.step}</span> : <span className="ws-icon">{item.icon}</span>}
      <span className="ws-item-text">
        <b>{item.label}</b>
        <small>{item.hint}</small>
      </span>
      {(!item.href || item.soon) && <em className="ws-soon">Soon</em>}
    </>
  );
  if (!item.href) return <div className="ws-item is-soon" aria-disabled="true">{body}</div>;
  return (
    <Link href={item.href} className={`ws-item ${pathname === item.href ? "is-active" : ""}`} aria-current={pathname === item.href ? "page" : undefined} onClick={onPick ? () => onPick(item) : undefined}>
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

// Bottom "Create" tab: one tap opens Create; a quick second tap pops up the sidebar shortcuts above the tab bar.
const SLOT_KEY = "eclipse-create-slot";
// Shortcuts that can take over the tab.
const SLOT_ITEMS: Item[] = [photo[0], ingredients, agentsItem, photo[1], photo[2]];

function CreateTab({ pathname }: { pathname: string }) {
  const [slot, setSlot] = useState<Item>(photo[0]);
  const [open, setOpen] = useState(false);
  const [bottom, setBottom] = useState(76);
  const lastTap = useRef(0);
  const tabRef = useRef<HTMLAnchorElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { const s = SLOT_ITEMS.find((i) => i.label === localStorage.getItem(SLOT_KEY)); if (s) setSlot(s); } catch {}
  }, []);
  function pick(item: Item) {
    if (!SLOT_ITEMS.includes(item)) return;
    setSlot(item);
    try { localStorage.setItem(SLOT_KEY, item.label); } catch {}
  }

  const openedAt = useRef(0);
  // The first tap of a double tap is still navigating when the menu opens, so ignore a route change that lands right after.
  useEffect(() => { if (Date.now() - openedAt.current > 1500) setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !tabRef.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("touchstart", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("touchstart", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  function show() {
    const r = tabRef.current?.closest(".mb-tabs")?.getBoundingClientRect();
    if (r) setBottom(window.innerHeight - r.top + 10);
    openedAt.current = Date.now();
    setOpen(true);
  }

  function onClick(e: React.MouseEvent) {
    const now = Date.now();
    if (now - lastTap.current < 400) {
      e.preventDefault(); // second tap: show shortcuts instead of opening Create again
      lastTap.current = 0;
      open ? setOpen(false) : show();
      return;
    }
    lastTap.current = now;
    setOpen(false);
  }

  return (
    <>
      <Link ref={tabRef} href={slot.href ?? "/create"} className={`mb-tab ${pathname === slot.href ? "is-active" : ""} ${open ? "is-open" : ""}`}
        aria-haspopup="menu" aria-expanded={open} title="Double-tap for shortcuts" onClick={onClick}
        onKeyDown={(e) => { if (e.key === "ArrowUp") { e.preventDefault(); show(); } }}>
        <span className="mb-tab-icon">{isValidElement(slot.icon) ? cloneElement(slot.icon as ReactElement<{ size?: number }>, { size: 21 }) : null}</span><span>{slot.label}</span>
      </Link>
      {open && (
        <div ref={menuRef} className="mb-shortcuts" role="menu" aria-label="Shortcuts" style={{ bottom }} onClick={() => setOpen(false)}>
          <NavItem item={ingredients} pathname={pathname} onPick={pick} />
          <NavItem item={agentsItem} pathname={pathname} onPick={pick} />
          <p className="mb-sc-label">PHOTO</p>
          {photo.map((i) => <NavItem key={i.label} item={i} pathname={pathname} onPick={pick} />)}
          <p className="mb-sc-label">VIDEO</p>
          {video.map((i) => <NavItem key={i.label} item={i} pathname={pathname} />)}
        </div>
      )}
    </>
  );
}

const TITLES: Record<string, string> = {
  "/project": "Eclipse Studio", "/create": "Create", "/gallery": "Gallery", "/library": "Library", "/assets": "Assets", "/ingredients": "Ingredients", "/agents": "Agents", "/avatars": "Avatars", "/portfolio": "Portfolio", "/certificates": "Certificates", "/settings": "Settings",
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
        <UserMenu variant="sidebar" />
      </aside>

      <div className="ws-content">
        <header className="ws-topbar">
          {!open && <button className="ws-icon-btn" aria-label="Open sidebar" onClick={() => setOpen(true)}><PanelLeft size={16} /></button>}
          <Link href="/dashboard" className="ws-back"><ArrowLeft size={15} /> Dashboard</Link>
          {project && <span className="ws-project" title="Current project">{project}</span>}
          <div className="ws-topbar-right">
            <Link href={tutorialHref(pathname)} className="ws-pill"><GraduationCap size={15} /> Tutorial</Link>
            <span className="ws-pill ws-pill-solid" title="Credits"><Coins size={14} /> 0</span>
            <ThemeToggle className="ws-icon-btn" />
            <SignOutButton className="ws-icon-btn" />
          </div>
        </header>
        <header className="mb-top">
          <button className="mb-icon" aria-label="Open menu" onClick={() => setDrawer(true)}><Menu size={22} /></button>
          <h1 className="mb-title">{TITLES[pathname] ?? "Eclipse Studio"}</h1>
          <div className="mb-right">
            <ThemeToggle className="mb-theme" />
            <UserMenu variant="avatar" />
          </div>
        </header>
        <main className="ws-main">{children}</main>
      </div>

      <nav className="mb-tabs" aria-label="Main">
        <Link href="/dashboard" className="mb-tab"><span className="mb-tab-icon"><House size={21} /></span><span>Home</span></Link>
        <CreateTab pathname={pathname} />
        <Link href="/library" className={`mb-tab ${pathname === "/library" ? "is-active" : ""}`}><span className="mb-tab-icon"><Library size={21} /></span><span>Library</span></Link>
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
            <Link href={tutorialHref(pathname)} className="mb-foot-link"><GraduationCap size={19} /> Tutorial</Link>
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

