"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cloneElement, isValidElement, useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import {
  ArrowLeft, ChevronDown, Coins, FolderOpen, GraduationCap, House, Image as ImageIcon, Images, Layers, LayoutDashboard, Library, Menu, Mic, Mountain, Music, Package, PanelLeft, PenLine, Settings, User, Video, Volume2, X,
} from "lucide-react";
import { AccountName, SignOutButton } from "@/components/account";
import AgentIcon from "@/components/AgentIcon";
import Avatar from "@/components/Avatar";
import UserMenu from "@/components/UserMenu";
import ThemeToggle from "@/components/ThemeToggle";
import "@/components/app-theme.css";
import { rememberPage } from "@/lib/last-page";
import { LIBRARY_KINDS } from "@/lib/library";
import { listProjects, readCurrentProject, readCurrentProjectName, setCurrentProject, timeAgo, type Project } from "@/lib/projects";
import { tutorialHref } from "@/lib/tutorial";
import "./workspace.css";

type Item = { label: string; hint: string; href?: string; icon?: React.ReactNode; step?: number; soon?: boolean };

const ingredients: Item = { label: "Ingredients", hint: "Character · Product · Scene", href: "/ingredients", icon: <Layers size={17} /> };
const photo: Item[] = [
  { label: "Create", hint: "Write a prompt", href: "/create", icon: <PenLine size={17} /> },
  { label: "Gallery", hint: "Finished renders", href: "/gallery", icon: <Images size={17} /> },
  { label: "Assets", hint: "Reference photos", href: "/assets", soon: true, icon: <FolderOpen size={17} /> },
];
const agentsItem: Item = { label: "Agents", hint: "Choose your agent", href: "/agents", icon: <AgentIcon size={17} /> };
const video: Item[] = [
  { label: "Treatment", hint: "Shape the concept", step: 1, href: "/treatment", soon: true },
  { label: "Prompts", hint: "Scene by scene", step: 2 },
  { label: "Generate", hint: "Render the clips", step: 3 },
  { label: "Export", hint: "Deliver and share", step: 4 },
];
const audio: Item[] = [
  { label: "Voiceover", hint: "Narrate your script", icon: <Mic size={17} /> },
  { label: "Music", hint: "Score your content", icon: <Music size={17} /> },
  { label: "Sound effects", hint: "Add the final touches", icon: <Volume2 size={17} /> },
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

function Section({ title, items, pathname, onPick, defaultOpen = true }: { title: string; items: Item[]; pathname: string; onPick?: (item: Item) => void; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  // If the page changes while it is showing (a double tap lands before the first tap finishes navigating), unfold the group that now holds the page.
  useEffect(() => { if (defaultOpen) setOpen(true); }, [defaultOpen]);
  return (
    <div className="ws-section">
      <button className="ws-section-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <ChevronDown size={13} className={open ? "" : "is-closed"} /> {title}
      </button>
      {open && items.map((i) => <NavItem key={i.label} item={i} pathname={pathname} onPick={onPick} />)}
    </div>
  );
}

// Bottom tabs Home, Create and Library: one tap opens the page, a quick second tap pops up shortcuts above the tab bar.
// `leaveTo`: for a tab whose page is outside the Studio (Home), the first tap waits briefly so a double tap can still reach the menu.
function useTabMenu(pathname: string, leaveTo?: string) {
  const router = useRouter();
  const wait = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ bottom: 76, left: 12 });
  const lastTap = useRef(0);
  const openedAt = useRef(0);
  const tabRef = useRef<HTMLAnchorElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
    const tab = tabRef.current?.getBoundingClientRect();
    const bar = tabRef.current?.closest(".mb-tabs")?.getBoundingClientRect();
    if (tab && bar) {
      const w = Math.min(310, window.innerWidth - 24);
      setPos({ bottom: window.innerHeight - bar.top + 10, left: Math.max(12, Math.min(tab.left + tab.width / 2 - w / 2, window.innerWidth - w - 12)) });
    }
    openedAt.current = Date.now();
    setOpen(true);
  }

  function onClick(e: React.MouseEvent) {
    if (leaveTo) {
      e.preventDefault();
      if (wait.current) { // second tap while waiting: menu instead of leaving
        clearTimeout(wait.current);
        wait.current = null;
        if (open) setOpen(false); else show();
        return;
      }
      setOpen(false);
      wait.current = setTimeout(() => { wait.current = null; router.push(leaveTo); }, 320);
      return;
    }
    const now = Date.now();
    if (now - lastTap.current < 400) {
      e.preventDefault(); // second tap: show shortcuts instead of opening the page again
      lastTap.current = 0;
      if (open) setOpen(false); else show();
      return;
    }
    lastTap.current = now;
    setOpen(false);
  }

  const onKeyDown = (e: React.KeyboardEvent) => { if (e.key === "ArrowUp") { e.preventDefault(); show(); } };
  return { open, setOpen, pos, tabRef, menuRef, onClick, onKeyDown };
}

type TabMenu = ReturnType<typeof useTabMenu>;

function TabMenuBox({ m, label, children }: { m: TabMenu; label: string; children: React.ReactNode }) {
  if (!m.open) return null;
  return (
    <div ref={m.menuRef} className="mb-shortcuts" role="menu" aria-label={label} style={{ bottom: m.pos.bottom, left: m.pos.left }}
      onClick={(e) => { if ((e.target as HTMLElement).closest('a, [role="menuitem"]')) m.setOpen(false); }}>
      {children}
    </div>
  );
}

const tabIcon = (icon: React.ReactNode) => (isValidElement(icon) ? cloneElement(icon as ReactElement<{ size?: number }>, { size: 21 }) : null);

const SLOT_KEY = "eclipse-create-slot";
// Shortcuts that can take over the Create tab.
const SLOT_ITEMS: Item[] = [photo[0], ingredients, agentsItem, photo[1], photo[2]];

function CreateTab({ pathname }: { pathname: string }) {
  const m = useTabMenu(pathname);
  const [slot, setSlot] = useState<Item>(photo[0]);

  // The tab follows the creation feature you are on, whether you got there from the sidebar, the menu or the shortcuts
  // popup; away from those pages it keeps the last one.
  useEffect(() => {
    const here = SLOT_ITEMS.find((i) => i.href === pathname);
    if (here) {
      setSlot(here);
      try { localStorage.setItem(SLOT_KEY, here.label); } catch {}
      return;
    }
    try { const s = SLOT_ITEMS.find((i) => i.label === localStorage.getItem(SLOT_KEY)); if (s) setSlot(s); } catch {}
  }, [pathname]);

  return (
    <>
      <Link ref={m.tabRef} href={slot.href ?? "/create"} className={`mb-tab ${pathname === slot.href ? "is-active" : ""} ${m.open ? "is-open" : ""}`}
        aria-haspopup="menu" aria-expanded={m.open} title="Double-tap for shortcuts" onClick={m.onClick} onKeyDown={m.onKeyDown}>
        <span className="mb-tab-icon">{tabIcon(slot.icon)}</span><span>{slot.label}</span>
      </Link>
      <TabMenuBox m={m} label="Shortcuts">
        <NavItem item={ingredients} pathname={pathname} />
        <NavItem item={agentsItem} pathname={pathname} />
        <Section title="PHOTO" items={photo} pathname={pathname} defaultOpen={photo.some((i) => i.href === pathname)} />
        <Section title="AUDIO" items={audio} pathname={pathname} defaultOpen={audio.some((i) => i.href === pathname)} />
        <Section title="VIDEO" items={video} pathname={pathname} defaultOpen={video.some((i) => i.href === pathname)} />
      </TabMenuBox>
    </>
  );
}

// Home: double tap lists your projects so you can jump straight into one.
function HomeTab({ pathname }: { pathname: string }) {
  const m = useTabMenu(pathname, "/dashboard");
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => {
    if (!m.open) return;
    setCurrentId(readCurrentProject()?.id ?? null);
    listProjects().then((l) => setProjects(l.filter((p) => !p.deletedAt))).catch(() => setProjects([]));
  }, [m.open]);

  function openProject(p: Project) {
    setCurrentProject(p);
    router.push("/project");
  }

  return (
    <>
      <Link ref={m.tabRef} href="/dashboard" className={`mb-tab ${m.open ? "is-open" : ""}`}
        aria-haspopup="menu" aria-expanded={m.open} title="Double-tap for your projects" onClick={m.onClick} onKeyDown={m.onKeyDown}>
        <span className="mb-tab-icon"><House size={21} /></span><span>Home</span>
      </Link>
      <TabMenuBox m={m} label="Your projects">
        <NavItem item={{ label: "All projects", hint: "Back to your dashboard", href: "/dashboard", icon: <LayoutDashboard size={17} /> }} pathname={pathname} />
        <p className="mb-sc-label">PROJECTS</p>
        {projects === null ? <p className="mb-sc-empty">Loading...</p>
          : projects.length === 0 ? <p className="mb-sc-empty">No projects yet.</p>
          : projects.map((p) => (
            <button key={p.id} type="button" role="menuitem" className={`ws-item ${p.id === currentId ? "is-active" : ""}`} aria-current={p.id === currentId ? "true" : undefined} onClick={() => openProject(p)}>
              <span className="ws-icon"><FolderOpen size={17} /></span>
              <span className="ws-item-text"><b>{p.name}</b><small>{timeAgo(p.updatedAt)}</small></span>
            </button>
          ))}
      </TabMenuBox>
    </>
  );
}

const KIND_ICONS: Record<string, React.ReactNode> = {
  All: <Library size={17} />, Ingredients: <Layers size={17} />, Images: <ImageIcon size={17} />, Videos: <Video size={17} />, Audio: <Music size={17} />,
};

// Library: double tap jumps to one kind of saved item.
function LibraryTab({ pathname }: { pathname: string }) {
  const m = useTabMenu(pathname);
  const current = m.open && typeof window !== "undefined" && pathname === "/library" ? new URLSearchParams(window.location.search).get("kind") ?? "All" : null;

  return (
    <>
      <Link ref={m.tabRef} href="/library" className={`mb-tab ${pathname === "/library" ? "is-active" : ""} ${m.open ? "is-open" : ""}`}
        aria-haspopup="menu" aria-expanded={m.open} title="Double-tap for library shortcuts" onClick={m.onClick} onKeyDown={m.onKeyDown}>
        <span className="mb-tab-icon"><Library size={21} /></span><span>Library</span>
      </Link>
      <TabMenuBox m={m} label="Library shortcuts">
        {LIBRARY_KINDS.map((k) => {
          const href = k === "All" ? "/library" : `/library?kind=${k}`;
          return (
            <NavItem key={k} pathname={current === k ? href : ""}
              item={{ label: k, hint: k === "All" ? "Everything you saved" : k === "Ingredients" ? "Characters, products, scenes" : `Saved ${k.toLowerCase()}`, href, icon: KIND_ICONS[k] }} />
          );
        })}
      </TabMenuBox>
    </>
  );
}

const TITLES: Record<string, string> = {
  "/project": "Eclipse Studio", "/create": "Create", "/gallery": "Gallery", "/library": "Library", "/assets": "Assets", "/ingredients": "Ingredients", "/agents": "Agents", "/treatment": "Treatment", "/avatars": "Avatars", "/portfolio": "Portfolio", "/certificates": "Certificates", "/settings": "Settings",
};

export default function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [project, setProject] = useState("");
  const [drawer, setDrawer] = useState(false);

  useEffect(() => { rememberPage(pathname); }, [pathname]);
  useEffect(() => {
    const sync = () => setProject(readCurrentProjectName());
    sync();
    window.addEventListener("eclipse-project-change", sync);
    return () => window.removeEventListener("eclipse-project-change", sync);
  }, [pathname]);

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
          <Section title="AUDIO" items={audio} pathname={pathname} />
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
        <HomeTab pathname={pathname} />
        <CreateTab pathname={pathname} />
        <LibraryTab pathname={pathname} />
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
            <Section title="AUDIO" items={audio} pathname={pathname} />
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

