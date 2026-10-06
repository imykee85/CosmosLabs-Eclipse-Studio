"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import "./notifications.css";

// Bell in the headers. Opens a small panel; there is nothing to show until the backend produces notifications
// (finished renders, shared work, credits), so it explains what will appear here.
export default function NotificationsButton({ className, up = false }: { className?: string; up?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

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
    <span className="nt" ref={ref}>
      <button type="button" className={className} aria-label="Notifications" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Bell size={16} />
      </button>
      {open && (
        <div className={`nt-pop ${up ? "is-up" : ""}`} role="dialog" aria-label="Notifications">
          <h2>Notifications</h2>
          <div className="nt-empty">
            <Bell size={30} strokeWidth={1.5} aria-hidden="true" />
            <p>You&apos;re all caught up</p>
            <small>Finished renders, shared work and credit updates will show up here.</small>
          </div>
        </div>
      )}
    </span>
  );
}
