"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, Coins, GraduationCap } from "lucide-react";
import NotificationsButton from "@/components/Notifications";
import { LogoMark } from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import { readLastPage } from "@/lib/last-page";
import { tutorialHref } from "@/lib/tutorial";
import "@/components/app-theme.css";
import "@/components/dashboard/dashboard.css";
import "@/components/workspace/workspace.css";
import "./account-shell.css";

// Dashboard-style header with the page below it; used by the avatar-menu pages, which are not part of the Studio.
export default function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [back, setBack] = useState("/dashboard");
  useEffect(() => setBack(readLastPage()), []);
  return (
    <div className="db-page">
      <header className="db-header">
        <div className="acct-left">
          <Link href="/dashboard" aria-label="Eclipse home" className="db-logo"><LogoMark size={48} /></Link>
          <Link href={back} className="ws-back acct-back" aria-label="Back" title="Back"><ChevronLeft size={24} /></Link>
        </div>
        <div className="db-header-right">
          <Link href={tutorialHref(pathname)} className="db-pill acct-tutorial" aria-label="Tutorial"><GraduationCap size={15} /> <span>Tutorial</span></Link>
          <span className="db-pill db-pill-solid" title="Credits"><Coins size={14} /> 0</span>
          <ThemeToggle className="db-icon" />
          <NotificationsButton className="db-icon" />
          <UserMenu />
        </div>
      </header>
      <main className="acct-main">
        {children}
      </main>
    </div>
  );
}
