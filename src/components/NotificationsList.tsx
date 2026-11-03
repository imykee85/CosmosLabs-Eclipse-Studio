"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, Bell, Check, Megaphone, Users } from "lucide-react";
import { APP_UPDATES } from "@/lib/app-updates";
import type { TeamInvite } from "./TeamInviteFeed";

// The tabs and the list shared by the small panel and the full page: Projects (what your renders, videos and voice takes did), App updates (what is new in
// Eclipse) and Account (credits, team invitations).
export type NotifItem = { id: string; type?: "project" | "account"; ok: boolean; title: string; body: string; href: string; at: string };
export type NotifTab = "projects" | "app" | "account";
const TABS: { id: NotifTab; label: string }[] = [{ id: "projects", label: "Projects" }, { id: "app", label: "App updates" }, { id: "account", label: "Account" }];

export const unreadCount = (items: NotifItem[], invites: TeamInvite[], seen: number) =>
  items.filter((i) => Date.parse(i.at) > seen).length + APP_UPDATES.filter((u) => Date.parse(u.at) > seen).length + invites.length;

export default function NotificationsList({ items, invites, seen, joining, onJoin, onNavigate, full = false }: {
  items: NotifItem[]; invites: TeamInvite[]; seen: number; joining: string; onJoin: (inv: TeamInvite) => void; onNavigate?: () => void; full?: boolean;
}) {
  const [tab, setTab] = useState<NotifTab>("projects");
  const projects = items.filter((i) => i.type !== "account");
  const account = items.filter((i) => i.type === "account");
  const empty = tab === "projects" ? projects.length === 0 : tab === "app" ? APP_UPDATES.length === 0 : account.length === 0 && invites.length === 0;

  const row = (i: NotifItem) => (
    <li key={i.id}>
      <Link href={i.href} onClick={onNavigate} className={Date.parse(i.at) > seen ? "is-new" : ""}>
        <span className={`nt-ico ${i.ok ? "ok" : "bad"}`}>{i.ok ? <Check size={13} /> : <AlertCircle size={13} />}</span>
        <span className="nt-txt"><b>{i.title}</b><small>{i.body}</small></span>
      </Link>
    </li>
  );

  return (
    <div className={`nt-body ${full ? "is-full" : ""}`}>
      <div className="nt-tabs" role="tablist" aria-label="Notification types">
        {TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "is-on" : ""} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>
      {empty ? (
        <div className="nt-empty">
          <Bell size={30} strokeWidth={1.5} aria-hidden="true" />
          <p>You&apos;re all caught up</p>
        </div>
      ) : (
        <ul className="nt-list">
          {tab === "projects" && projects.map(row)}
          {tab === "account" && invites.map((inv) => (
            <li key={inv.id} className="nt-invite">
              <span className="nt-ico team"><Users size={13} /></span>
              <span className="nt-txt"><b>{inv.team} invited you to join their team</b><small>You would join as {inv.role}. Teams share credits, projects and the Library.</small></span>
              <button type="button" className="nt-join" disabled={joining === inv.id} onClick={() => onJoin(inv)}>Join</button>
            </li>
          ))}
          {tab === "account" && account.map(row)}
          {tab === "app" && APP_UPDATES.map((u) => {
            const inner = (
              <>
                <span className="nt-ico app"><Megaphone size={13} /></span>
                <span className="nt-txt"><b>{u.title}</b><small>{u.body}</small></span>
              </>
            );
            const cls = Date.parse(u.at) > seen ? "is-new" : "";
            return <li key={u.id}>{u.href ? <Link href={u.href} onClick={onNavigate} className={cls}>{inner}</Link> : <div className={`nt-plain ${cls}`}>{inner}</div>}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
