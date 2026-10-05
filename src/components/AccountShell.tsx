"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins, GraduationCap } from "lucide-react";
import { SignOutButton } from "@/components/account";
import { LogoMark } from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import { tutorialHref } from "@/lib/tutorial";
import "@/components/app-theme.css";
import "@/components/dashboard/dashboard.css";
import "@/components/workspace/workspace.css";
import "./account-shell.css";

// Dashboard-style header with the page below it; used by the avatar-menu pages, which are not part of the Studio.
export default function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="db-page">
      <header className="db-header">
        <Link href="/dashboard" aria-label="Back to dashboard" className="db-logo"><LogoMark size={48} /></Link>
        <div className="db-header-right">
          <Link href={tutorialHref(pathname)} className="db-pill"><GraduationCap size={15} /> Tutorial</Link>
          <span className="db-pill db-pill-solid" title="Credits"><Coins size={14} /> 0</span>
          <ThemeToggle className="db-icon" />
          <SignOutButton className="db-icon" />
          <UserMenu />
        </div>
      </header>
      <main className="acct-main">{children}</main>
    </div>
  );
}
