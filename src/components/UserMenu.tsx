"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Award, GraduationCap, LayoutGrid, LogOut, Settings } from "lucide-react";
import { AccountName, SignOutButton } from "@/components/account";
import Avatar from "@/components/Avatar";
import SoonTag from "@/components/SoonTag";
import { tutorialHref } from "@/lib/tutorial";
import "./user-menu.css";

// Tutorial opens with the page you are on as its "back" target (the href is filled in below).
const ITEMS = [
  { label: "Tutorial", href: "", icon: GraduationCap, soon: false },
  { label: "Portfolio", href: "/portfolio", icon: LayoutGrid, soon: false },
  { label: "Certificates", href: "/certificates", icon: Award, soon: true },
  { label: "Settings", href: "/settings", icon: Settings, soon: false },
];

// Account button for the header: avatar (+ name on wide screens) that opens a small menu of shortcuts.
export default function UserMenu({ variant = "header" }: { variant?: "header" | "sidebar" | "avatar" }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent | TouchEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("touchstart", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("touchstart", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div className={`um um-v-${variant}`} ref={ref}>
      <AccountName>
        {(name, image) => (
          <button type="button" className="um-btn" aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen((o) => !o)}>
            {variant !== "avatar" && <span className="um-text"><strong>{name}</strong><span>{variant === "sidebar" ? "Trial plan" : "trial plan"}</span></span>}
            <Avatar name={name} image={image} className="um-avatar" />
          </button>
        )}
      </AccountName>
      {open && (
        <div className="um-menu" role="menu">
          {ITEMS.map(({ label, href, icon: Icon, soon }) => (
            <Link key={label} href={label === "Tutorial" ? tutorialHref(pathname) : href} role="menuitem" className="um-item" onClick={() => setOpen(false)}>
              <Icon size={17} /> {label}{soon && <SoonTag className="um-soon" />}
            </Link>
          ))}
          <span className="um-sep" role="separator" />
          <SignOutButton className="um-item um-out"><LogOut size={17} /> Log out</SignOutButton>
        </div>
      )}
    </div>
  );
}
