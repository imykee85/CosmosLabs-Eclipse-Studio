"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Award, Images, LayoutGrid, Settings, User } from "lucide-react";
import { AccountName } from "@/components/account";
import Avatar from "@/components/Avatar";
import "./user-menu.css";

const ITEMS = [
  { label: "Gallery", href: "/gallery", icon: Images },
  { label: "Avatars", href: "/avatars", icon: User },
  { label: "Portfolio", href: "/portfolio", icon: LayoutGrid },
  { label: "Certificates", href: "/certificates", icon: Award },
  { label: "Settings", href: "/settings", icon: Settings },
];

// Account button for the header: avatar (+ name on wide screens) that opens a small menu of shortcuts.
export default function UserMenu() {
  const [open, setOpen] = useState(false);
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
    <div className="um" ref={ref}>
      <AccountName>
        {(name, image) => (
          <button type="button" className="um-btn" aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen((o) => !o)}>
            <span className="um-text"><strong>{name}</strong><span>trial plan</span></span>
            <Avatar name={name} image={image} className="um-avatar" />
          </button>
        )}
      </AccountName>
      {open && (
        <div className="um-menu" role="menu">
          {ITEMS.map(({ label, href, icon: Icon }) => (
            <Link key={href} href={href} role="menuitem" className="um-item" onClick={() => setOpen(false)}>
              <Icon size={17} /> {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
