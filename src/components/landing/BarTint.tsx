"use client";

import { useEffect, useState } from "react";

// A thin fixed strip at the very top edge in the hero's own deep red (measured from the hero picture, rgb 85 30 30). iPhone Safari tints its
// floating top bar from what sits at the top edge, so over the hero the bar takes this colour instead of black. It is hidden once the hero has
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
