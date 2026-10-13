"use client";

import Link from "next/link";

// One plain screen for "something broke" and "no such page", used by the app's error boundaries. It reads the theme colours when they exist (inside the app) and falls back to black.
export default function ErrorScreen({ title, text, onRetry, homeHref = "/dashboard", homeLabel = "Back to the dashboard" }: { title: string; text: string; onRetry?: () => void; homeHref?: string; homeLabel?: string }) {
  const btn = { display: "inline-flex", alignItems: "center", height: 42, padding: "0 20px", borderRadius: 999, font: "inherit", fontSize: 15, fontWeight: 500, textDecoration: "none", cursor: "pointer" } as const;
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "var(--a-bg, #000)", color: "var(--a-fg, #fff)", textAlign: "center" }}>
      <div style={{ maxWidth: 420 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-.02em" }}>{title}</h1>
        <p style={{ margin: "12px 0 24px", color: "var(--a-muted, #a3a3a3)", fontSize: 15, lineHeight: 1.5 }}>{text}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {onRetry && <button type="button" onClick={onRetry} style={{ ...btn, border: 0, background: "#c00707", color: "#fff" }}>Try again</button>}
          <Link href={homeHref} style={{ ...btn, border: "1px solid var(--a-line2, rgba(255,255,255,.2))", background: "transparent", color: "inherit" }}>{homeLabel}</Link>
        </div>
      </div>
    </main>
  );
}
