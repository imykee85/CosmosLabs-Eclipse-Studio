"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isLang } from "@/lib/i18n/languages";
import { startTranslator } from "@/lib/i18n/translator";

// The visitor's language and local currency. Detected on the server from the connection (see /api/locale and the middleware's language cookie),
// overridden by the person's own choice (kept in this browser), and applied to the whole page by the translator.
type Locale = { lang: string; currency: string; rate: number; country: string | null };
type Ctx = Locale & { setLang: (code: string) => void };

const LS_CHOICE = "eclipse-locale"; // { lang } chosen by the person
const COOKIE = "eclipse-lang";
const DEFAULT: Locale = { lang: "en", currency: "USD", rate: 1, country: null };

const LocaleCtx = createContext<Ctx>({ ...DEFAULT, setLang: () => {} });
export const useLocale = () => useContext(LocaleCtx);

function readCookie(): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}
function readChoice(): string | null {
  try { const v = JSON.parse(localStorage.getItem(LS_CHOICE) || "null") as { lang?: unknown } | null; return isLang(v?.lang) ? v!.lang as string : null; } catch { return null; }
}

export default function LocaleProvider({ children }: { children: ReactNode }) {
  const [loc, setLoc] = useState<Locale>(DEFAULT);

  // Language: the person's choice, else the cookie the server set from their connection. Then the detected currency and today's rate.
  useEffect(() => {
    let off = false;
    const chosen = readChoice();
    const hinted = readCookie();
    const initial = chosen ?? (isLang(hinted) ? hinted : "en");
    setLoc((l) => ({ ...l, lang: initial }));
    fetch("/api/locale").then((r) => (r.ok ? r.json() : null)).then((d: { lang?: string; currency?: string; rate?: number; country?: string | null } | null) => {
      if (off || !d) return;
      const lang = chosen ?? (isLang(d.lang) ? d.lang : initial);
      setLoc({ lang, currency: d.currency || "USD", rate: typeof d.rate === "number" ? d.rate : 1, country: d.country ?? null });
      if (!chosen && lang !== initial) {
        document.cookie = `${COOKIE}=${lang}; Path=/; Max-Age=2592000; SameSite=Lax`;
        let again = false; try { again = sessionStorage.getItem("eclipse-lang-reloaded") === "1"; sessionStorage.setItem("eclipse-lang-reloaded", "1"); } catch { again = true; }
        if (!again) window.location.reload(); // once per visit, and only if the cookie really stuck
      }
    }).catch(() => {});
    return () => { off = true; };
  }, []);

  // Translate the page. English needs nothing.
  useEffect(() => {
    const root = document.documentElement;
    root.lang = loc.lang;
    if (loc.lang === "en") { root.removeAttribute("data-i18n"); return; }
    const done = () => root.removeAttribute("data-i18n");
    const fallback = setTimeout(done, 1500); // never leave the page hidden
    const stop = startTranslator(loc.lang, () => { clearTimeout(fallback); done(); });
    return () => { clearTimeout(fallback); stop(); };
  }, [loc.lang]);

  const setLang = useCallback((code: string) => {
    if (!isLang(code)) return;
    try { localStorage.setItem(LS_CHOICE, JSON.stringify({ lang: code })); } catch { /* blocked storage: the cookie still carries it */ }
    document.cookie = `${COOKIE}=${code}; Path=/; Max-Age=2592000; SameSite=Lax`;
    window.location.reload(); // the page is rebuilt in the new language (or English) from scratch: no half-translated state
  }, []);

  const value = useMemo(() => ({ ...loc, setLang }), [loc, setLang]);
  return <LocaleCtx.Provider value={value}>{children}</LocaleCtx.Provider>;
}
