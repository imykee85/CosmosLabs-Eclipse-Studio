"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "eclipse-theme";

// Phone browsers tint their status bar and toolbars from <meta name="theme-color">. Without it Safari samples the page colour once at load
// and keeps it after the toggle, so the bars stay in the old theme until a refresh. The tag is replaced (not edited) so Safari re-reads it.
function setBarColor(light: boolean) {
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = light ? "#faf8f5" : "#000000";
  const old = document.querySelector('meta[name="theme-color"]');
  if (old) old.replaceWith(meta); else document.head.appendChild(meta);
}

// Switches the app screens between dark (default) and light. The choice is remembered in this browser.
export default function ThemeToggle({ className }: { className?: string }) {
  const [light, setLight] = useState(false);

  useEffect(() => {
    const isLight = document.documentElement.getAttribute("data-app-theme") === "light";
    setLight(isLight);
    setBarColor(isLight);
    // Leaving the app screens (the marketing site is always dark): drop the tag so the bars follow the page again.
    return () => document.querySelector('meta[name="theme-color"]')?.remove();
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    if (next) document.documentElement.setAttribute("data-app-theme", "light");
    else document.documentElement.removeAttribute("data-app-theme");
    setBarColor(next);
    // iPhone Safari re-reads the colour of its bars only when the page loads (the tag above is ignored by newer versions), so on iOS the
    // choice is saved and the page reloads; everywhere else the switch is instant.
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) setTimeout(() => window.location.reload(), 120);
    try { localStorage.setItem(KEY, next ? "light" : "dark"); } catch {}
  }

  return (
    <button type="button" className={className} onClick={toggle} aria-label={light ? "Switch to dark mode" : "Switch to light mode"} title={light ? "Dark mode" : "Light mode"}>
      {light ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
