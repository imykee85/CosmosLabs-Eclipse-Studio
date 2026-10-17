"use client";

import { useEffect, useState } from "react";
import { Coins, Loader2, Scissors, X } from "lucide-react";
import SheetPortal from "../voice/SheetPortal";
import type { Render } from "@/lib/use-renders";
import { findVideoModel, videoPrice } from "@/lib/video-models";
import "../voice/voice.css";

// "Edit video" on a finished video: Seedance 2.5 changes what is in the clip as the prompt says (Edit), or continues it by 4 to 30 seconds (Extend).
// The new clip is made like any other video and appears in the Gallery and Library; the original stays as it is.
export default function EditVideoDialog({ video, onClose, onStarted }: { video: Render; onClose: () => void; onStarted?: (id: string) => void }) {
  const [mode, setMode] = useState<"edit" | "extend">("edit");
  const [prompt, setPrompt] = useState("");
  const [ext, setExt] = useState(5);
  const [res, setRes] = useState("720p");
  const [audio, setAudio] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const [creditsOn, setCreditsOn] = useState(false);
  useEffect(() => { fetch("/api/video/config").then((r) => (r.ok ? r.json() : null)).then((c) => setCreditsOn(!!c?.creditsOn)).catch(() => {}); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const model = findVideoModel("seedance_2_5");
  const seconds = mode === "edit" ? Math.max(1, Math.ceil(video.durationSec ?? 5)) : ext;
  const price = creditsOn && model ? videoPrice(model, res, seconds, audio) : null;

  async function go(confirm = false): Promise<void> {
    if (!prompt.trim() || busy) return;
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/video/edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceId: video.id, mode, prompt: prompt.trim(), duration: mode === "extend" ? ext : undefined, resolution: res, audio, projectId: video.projectId ?? undefined, confirm: confirm || undefined }) });
      const d = await r.json().catch(() => ({}));
      if (r.status === 409 && d.needsConfirm) { setBusy(false); if (window.confirm(`This costs ${d.cost} credits. Start it?`)) return go(true); return; }
      if (!r.ok) { setError(typeof d.error === "string" ? d.error : "Could not start. Please try again."); return; }
      setStarted(true);
      if (typeof d.id === "string") onStarted?.(d.id);
    } catch { setError("Could not reach the server. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  return (
    <SheetPortal><div className="rd-scrim" onClick={onClose}>
      <div className="vc-as" role="dialog" aria-modal="true" aria-label="Edit video" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="rd-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <h2><Scissors size={18} aria-hidden="true" /> Edit video</h2>
        {started ? (
          <p className="vc-as-wait" role="status">Started. The new clip appears in your Gallery and Library when it is ready.</p>
        ) : (
          <>
            <video className="vc-st-video" src={video.imageUrl ?? undefined} muted playsInline controls preload="metadata" aria-label="Your video" />
            <div className="vc-as-row" role="tablist" aria-label="Edit or extend">
              <button type="button" role="tab" aria-selected={mode === "edit"} className={`vc-pill ${mode === "edit" ? "is-on" : ""}`} onClick={() => setMode("edit")}>Edit</button>
              <button type="button" role="tab" aria-selected={mode === "extend"} className={`vc-pill ${mode === "extend" ? "is-on" : ""}`} onClick={() => setMode("extend")}>Extend</button>
            </div>
            <label className="vc-as-field">
              <span>{mode === "edit" ? "What should change" : "What happens next"}</span>
              <textarea rows={3} value={prompt} maxLength={5000} onChange={(e) => { setPrompt(e.target.value); setError(""); }} placeholder={mode === "edit" ? "Make it night time with rain on the windows" : "The camera pulls back to reveal the whole city"} />
            </label>
            <div className="vc-as-row">
              {mode === "extend" && (
                <label className="vc-pill vc-select"><span className="sr-only">Extend by</span>
                  <select aria-label="Extend by" value={ext} onChange={(e) => setExt(Number(e.target.value))}>{Array.from({ length: 27 }, (_, i) => i + 4).map((s) => <option key={s} value={s}>+{s} s</option>)}</select>
                </label>
              )}
              <label className="vc-pill vc-select"><span className="sr-only">Quality</span>
                <select aria-label="Quality" value={res} onChange={(e) => setRes(e.target.value)}>{["480p", "720p", "1080p"].map((r) => <option key={r} value={r}>{r}</option>)}</select>
              </label>
              <button type="button" className={`vc-pill ${audio ? "is-on" : ""}`} aria-pressed={audio} onClick={() => setAudio((v) => !v)}>Sound</button>
            </div>
            {error && <p className="vc-error" role="alert">{error}</p>}
            <button type="button" className="vc-as-go" onClick={() => void go()} disabled={busy || !prompt.trim()}>
              {busy && <Loader2 size={16} className="vc-spin" />} {mode === "edit" ? "Edit with Seedance 2.5" : "Extend with Seedance 2.5"}
              {price != null && <span className="vc-cost"><Coins size={12} />{price}</span>}
            </button>
          </>
        )}
      </div>
    </div></SheetPortal>
  );
}
