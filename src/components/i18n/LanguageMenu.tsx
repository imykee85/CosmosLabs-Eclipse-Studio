"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { LANGS } from "@/lib/i18n/languages";
import { useLocale } from "./LocaleProvider";

// Footer language switcher for the public site. Choosing a language is remembered in this browser and the page reloads in it.
export default function LanguageMenu({ nav = false }: { nav?: boolean }) {
  const { lang, setLang } = useLocale();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];
  return (
    <div className={`lang-menu ${nav ? "is-nav" : ""}`} ref={box} translate="no">
      <button type="button" className="lang-btn" aria-haspopup="listbox" aria-label={current.native} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Globe size={nav ? 20 : 14} strokeWidth={1.6} /> {nav ? current.code.toUpperCase() : current.native}{nav && <ChevronDown size={14} />}
      </button>
      {open && (
        <ul className="lang-list" role="listbox" aria-label="Language">
          {LANGS.map((l) => (
            <li key={l.code}>
              <button type="button" role="option" aria-selected={l.code === lang} className={l.code === lang ? "is-on" : ""} onClick={() => { setOpen(false); if (l.code !== lang) setLang(l.code); }}>
                <span>{l.native}</span>{l.code === lang && <Check size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
