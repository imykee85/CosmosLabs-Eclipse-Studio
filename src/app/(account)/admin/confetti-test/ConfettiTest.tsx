"use client";

import { useState } from "react";
import { launchConfetti, playPops } from "@/components/dashboard/confetti";

export default function ConfettiTest() {
  const [n, setN] = useState(0);
  return (
    <main style={{ padding: 16, maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Confetti sound test</h1>
      <p className="app-muted" style={{ margin: "6px 0 14px" }}>Tap the button. You should see confetti and hear about nine short pops. Turn the ringer on and the volume up; on an iPhone the silent switch can mute it.</p>
      <button type="button" className="app-btn" style={{ padding: "12px 20px", fontSize: 16 }} onClick={() => { launchConfetti(); playPops(); setN((v) => v + 1); }}>Play confetti and sound</button>
      <p className="app-muted" style={{ marginTop: 12 }}>{n ? `Played ${n} time${n === 1 ? "" : "s"}.` : "Not played yet."}</p>
    </main>
  );
}
