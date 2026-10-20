"use client";

import { useEffect, useState } from "react";

// A fixed band (64px plus the safe area, fading out at its lower edge) at the very top edge in the hero's own deep red (measured from the hero picture, rgb 85 30 30). iPhone Safari tints its
// floating top bar from a real, full-width bar at the top edge (a 3px strip was NOT enough on the owner's phone, 2026-10-20), so over the hero the bar takes this colour instead of black. It is hidden once the hero has
// scrolled away, so the bar follows the sections below.
export default function BarTint() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const check = () => {
      const hero = document.querySelector(".hero");
      const h = hero ? hero.getBoundingClientRect().bottom + window.scrollY : 600;
      setOn(window.scrollY < h - 120);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, []);
  return <div aria-hidden="true" className="bar-tint" style={{ opacity: on ? 1 : 0 }} />;
}
