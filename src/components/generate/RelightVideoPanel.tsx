"use client";

import { useEffect, useState } from "react";
import RelightPanel, { type RelightRun } from "../create/RelightPanel";
import type { Render } from "@/lib/use-renders";
import { findVideoModel, videoPrice } from "@/lib/video-models";
import { relightVideoPrompt } from "@/lib/relight/prompt";

const TIERS = ["480p", "720p", "1080p"];

/** Relight for a finished video: the same light placement as Image Studio, sent as a Seedance 2.5 edit of the clip (length and movement kept). */
export default function RelightVideoPanel({ video, onClose, onStarted }: { video: Render; onClose: () => void; onStarted: (id?: string) => void }) {
  const [thumb, setThumb] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [creditsOn, setCreditsOn] = useState(false);
  const [direct, setDirect] = useState<string[]>([]);
  useEffect(() => { fetch("/api/video/config").then((r) => (r.ok ? r.json() : null)).then((c) => { setCreditsOn(!!c?.creditsOn); setDirect(Array.isArray(c?.direct) ? c.direct : []); }).catch(() => {}); }, []);
  // A still from the clip for the light preview (same address, so the browser may read it).
  useEffect(() => {
    let dead = false;
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.crossOrigin = "anonymous";
    v.onloadeddata = () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); };
    v.onseeked = () => {
      try { const c = document.createElement("canvas"); const w = Math.min(960, v.videoWidth || 960); c.width = w; c.height = Math.round(w * ((v.videoHeight || 540) / (v.videoWidth || 960))); c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height); if (!dead) setThumb(c.toDataURL("image/jpeg", 0.8)); } catch { /* preview stays flat */ }
    };
    v.src = video.imageUrl ?? "";
    return () => { dead = true; v.removeAttribute("src"); v.load(); };
  }, [video.imageUrl]);
  const model = findVideoModel("seedance_2_5");
  const seconds = Math.max(1, Math.ceil(video.durationSec ?? 5));
  const unit = (t: string) => (creditsOn && model ? videoPrice(model, t, seconds, true, direct.includes(model.id) ? "direct" : "higgsfield") : null);

  async function run(r: RelightRun, confirm = false): Promise<void> {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/video/edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceId: video.id, mode: "edit", prompt: relightVideoPrompt(r.lights, r.note), resolution: r.tier, audio: true, confirm }) });
      const d = await res.json().catch(() => ({}));
      if (res.status === 409 && d.needsConfirm) { setBusy(false); if (window.confirm(`This costs ${d.cost} credits. Start it?`)) return run(r, true); return; }
      if (!res.ok) { setError(typeof d.error === "string" ? d.error : "Could not start. Please try again."); return; }
      onStarted(typeof d.id === "string" ? d.id : undefined);
      onClose();
    } catch { setError("Could not reach the server. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  return <RelightPanel thumb={thumb} tiers={TIERS} unit={unit} freeLeft={0} busy={busy} error={error} onRun={(r) => void run(r)} onClose={onClose} single subtitle="The same clip, lit from somewhere else" />;
}
