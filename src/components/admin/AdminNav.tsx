"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Dashboard" }, { href: "/admin/users", label: "Users" }, { href: "/admin/credits", label: "Credits and plans" },
  { href: "/admin/health", label: "Health" }, { href: "/admin/jobs", label: "Jobs" }, { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/expiry", label: "Expiry" }, { href: "/admin/translations", label: "Translations" }, { href: "/admin/sandbox", label: "Sandbox" },
];

export default function AdminNav() {
  const path = usePathname(), router = useRouter();
  async function out() { await fetch("/api/admin/logout", { method: "POST" }).catch(() => {}); router.replace("/admin/login"); router.refresh(); }
  return (
    <nav className="ad-nav" aria-label="Admin">
      {LINKS.map((l) => <Link key={l.href} href={l.href} className={path === l.href ? "is-on" : ""}>{l.label}</Link>)}
      <button type="button" onClick={out}>Lock</button>
    </nav>
  );
}
