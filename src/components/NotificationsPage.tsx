"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { clerkEnabled } from "@/lib/clerk-enabled";
import TeamInviteFeed, { type TeamInvite } from "./TeamInviteFeed";
import NotificationsList, { type NotifItem } from "./NotificationsList";
import "./notifications.css";

// The notifications as a full page (the expand icon of the panel opens it). Reading it marks everything as seen, like the panel does.
const SEEN = "eclipse-notif-seen";
export default function NotificationsPage() {
  const [items, setItems] = useState<NotifItem[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [joining, setJoining] = useState("");
  const [seen, setSeen] = useState(0);
  useEffect(() => {
    let before = 0;
    try { before = Number(localStorage.getItem(SEEN)) || 0; localStorage.setItem(SEEN, String(Date.now())); } catch {}
    setSeen(before); // what was new before this visit keeps its dot while the page is open
    let live = true;
    fetch("/api/notifications", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { items: [] })).then((d) => { if (live && Array.isArray(d.items)) setItems(d.items); }).catch(() => {});
    return () => { live = false; };
  }, []);
  async function join(inv: TeamInvite) {
    setJoining(inv.id);
    try { await inv.join(); } catch { /* the invitation stays so it can be tried again */ }
    setJoining("");
  }
  return (
    <div className="nt-page">
      <Link href="/dashboard" className="mo-back" style={{ display: "inline-flex", alignItems: "center", gap: 4, margin: "8px 0 4px", color: "var(--a-muted)", fontSize: 14, textDecoration: "none" }}><ChevronLeft size={18} /> Dashboard</Link>
      {clerkEnabled && <TeamInviteFeed onChange={setInvites} />}
      <h1>Notifications</h1>
      <NotificationsList items={items} invites={invites} seen={seen} joining={joining} onJoin={(inv) => void join(inv)} full />
    </div>
  );
}
