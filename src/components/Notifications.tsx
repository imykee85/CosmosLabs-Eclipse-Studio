"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Maximize2 } from "lucide-react";
import { clerkEnabled } from "@/lib/clerk-enabled";
import TeamInviteFeed, { type TeamInvite } from "./TeamInviteFeed";
import NotificationsList, { type NotifItem, unreadCount } from "./NotificationsList";
import "./notifications.css";

// Bell in the headers (or, with `label`, a row with the bell next to a text such as "Notifications" in the phone side menu). Opens a small panel listing what finished or failed
// in the last 3 days (renders, videos, voice takes); a red dot shows when something ended since the panel was last opened (the time is kept in this browser).
const SEEN = "eclipse-notif-seen";
const readSeen = () => { try { return Number(localStorage.getItem(SEEN)) || 0; } catch { return 0; } };
export default function NotificationsButton({ className, up = false, label }: { className?: string; up?: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const [items, setItems] = useState<NotifItem[]>([]);
  const [seen, setSeen] = useState(0);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [joining, setJoining] = useState("");
  useEffect(() => {
    setSeen(readSeen());
    let live = true;
    const load = () => { if (document.visibilityState === "hidden") return; fetch("/api/notifications", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { items: [] })).then((d) => { if (live && Array.isArray(d.items)) setItems(d.items); }).catch(() => {}); };
    load();
    const t = setInterval(load, 180_000);
    return () => { live = false; clearInterval(t); };
  }, []);
  const unread = unreadCount(items, invites, seen); // an invitation stays "new" until it is answered
  function toggle() {
    setOpen((o) => {
      if (!o) { const now = Date.now(); try { localStorage.setItem(SEEN, String(now)); } catch {} setTimeout(() => setSeen(now), 1500); } // the dot stays while the list is first read
      return !o;
    });
  }

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent | TouchEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("touchstart", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("touchstart", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  async function join(inv: TeamInvite) {
    setJoining(inv.id);
    try { await inv.join(); setOpen(false); } catch { /* the invitation stays in the list so it can be tried again */ }
    setJoining("");
  }

  return (
    <span className={`nt ${label ? "nt-row" : ""}`} ref={ref}>
      {clerkEnabled && <TeamInviteFeed onChange={setInvites} />}
      <button type="button" className={className} aria-label="Notifications" aria-haspopup="dialog" aria-expanded={open} onClick={toggle}>
        {label ? <><Bell size={19} /> {label}</> : <Bell size={16} />}{unread > 0 && <i className="nt-dot" aria-label={`${unread} new`} />}
      </button>
      {open && (
        <div className={`nt-pop ${up ? "is-up" : ""}`} role="dialog" aria-label="Notifications">
          <div className="nt-head">
            <h2>Notifications</h2>
            <Link href="/notifications" className="nt-expand" aria-label="Open notifications as a full page" title="Open as a full page" onClick={() => setOpen(false)}><Maximize2 size={15} /></Link>
          </div>
          <NotificationsList items={items} invites={invites} seen={seen} joining={joining} onJoin={(inv) => void join(inv)} onNavigate={() => setOpen(false)} />
        </div>
      )}
    </span>
  );
}
