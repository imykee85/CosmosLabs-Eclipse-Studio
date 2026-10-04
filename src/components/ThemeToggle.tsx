"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "eclipse-theme";

// Switches the app screens between dark (default) and light. The choice is remembered in this browser.
export default function ThemeToggle({ className }: { className?: string }) {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.getAttribute("data-app-theme") === "light");
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    if (next) document.documentElement.setAttribute("data-app-theme", "light");
    else document.documentElement.removeAttribute("data-app-theme");
    try { localStorage.setItem(KEY, next ? "light" : "dark"); } catch {}
  }

  return (
    <button type="button" className={className} onClick={toggle} aria-label={light ? "Switch to dark mode" : "Switch to light mode"} title={light ? "Dark mode" : "Light mode"}>
      {light ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
