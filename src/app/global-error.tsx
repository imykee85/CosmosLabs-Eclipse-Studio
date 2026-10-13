"use client";

import { useEffect } from "react";

// The last safety net: an error in the root layout itself. It must draw its own <html> and <body>.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("global error", { message: error.message, digest: error.digest }); }, [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#000", color: "#fff", fontFamily: "system-ui, sans-serif", textAlign: "center", padding: 24 }}>
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ margin: 0, fontSize: 26 }}>Something went wrong</h1>
          <p style={{ margin: "12px 0 24px", color: "#a3a3a3", lineHeight: 1.5 }}>Eclipse hit a problem loading. Your work is saved. Try again in a moment.</p>
          <button type="button" onClick={reset} style={{ height: 42, padding: "0 20px", border: 0, borderRadius: 999, background: "#c00707", color: "#fff", fontSize: 15, cursor: "pointer" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
