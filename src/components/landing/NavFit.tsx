"use client";

import { useEffect } from "react";

// Some languages have much longer words (Spanish "Iniciar sesión / Registrarse", German, Russian), so the nav row ran past the screen edge.
// This shrinks the nav text one pixel at a time, only as far as needed, until the whole row fits; it re-checks when the language changes
// (the translator rewrites the text) and when the window turns or resizes. Nothing changes for English or wherever the row already fits.
export default function NavFit() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".nav-wrap");
    if (!header) return;
    let raf = 0;
    const fit = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        header.style.removeProperty("--nf");
        header.removeAttribute("data-fit");
        if (window.matchMedia("(max-width: 800px)").matches) return; // the menu button layout has its own room
        const room = () => header.scrollWidth <= document.documentElement.clientWidth && (document.querySelector(".nav-actions .pill-btn")?.getBoundingClientRect().right ?? 0) <= document.documentElement.clientWidth - 14;
        if (room()) return;
        header.setAttribute("data-fit", "1");
        for (let px = 17; px >= 10; px--) {
          header.style.setProperty("--nf", `${px}px`);
          if (room()) return;
        }
      });
    };
    fit();
    const mo = new MutationObserver(fit);
    mo.observe(header, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", fit);
    return () => { cancelAnimationFrame(raf); mo.disconnect(); window.removeEventListener("resize", fit); };
  }, []);
  return null;
}
