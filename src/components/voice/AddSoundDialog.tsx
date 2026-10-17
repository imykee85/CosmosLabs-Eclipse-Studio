"use client";

import { useEffect, useRef, useState } from "react";
import { Coins, Loader2, Volume2, X } from "lucide-react";
import type { Render } from "@/lib/use-renders";
import { fetchAudioItem, quoteSound, startVoice, useVoiceModels, type AudioItem } from "@/lib/use-voice";
import SheetPortal from "./SheetPortal";
import SoundTake from "./SoundTake";
import "./voice.css";

// "Add sound" on a finished video (Mirelo sound for video): an optional description, keep the speech or not, how many variants, the file format and the price (asked from the
// provider BEFORE anything starts). The result is heard on the video itself, and every variant is saved as a take in Voice Studio.
export default function AddSoundDialog({ video, onClose }: { video: Render; onClose: () => void }) {
  const { models } = useVoiceModels();
  const model = models?.find((m) => m.kinds.includes("vsfx") && m.options.videoInput) ?? null;
  const [prompt, setPrompt] = useState("");
  const [speech, setSpeech] = useState(true);
  const [variants, setVariants] = useState(2);
  const [format, setFormat] = useState("wav");
  const [price, setPrice] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [item, setItem] = useState<AudioItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const body = { kind: "vsfx", model: model?.id, videoId: video.id, text: prompt.trim(), preserveSpeech: speech, variants, format };

  // The quote follows the settings (a moment after the last change).
  useEffect(() => {
    if (!model?.ready || item) return;
    setPrice(null);
    const t = setTimeout(async () => { const q = await quoteSound({ ...body }); if (q.ok) { setPrice(q.credits); setError(""); } else setError(q.error); }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model?.id, model?.ready, speech, variants, format, prompt, item]);

  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);

  // Follow the take until it finishes.
  useEffect(() => {
    if (!item || item.status !== "pending") return;
    timer.current = setTimeout(async () => { const next = await fetchAudioItem(item.id); if (next) setItem(next); }, 3000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [item]);

  async function go() {
    if (!model) return;
    if (!model.ready) { setError(`${model.providerLabel} is not connected yet. It works once its key is set.`); return; }
    setBusy(true); setError("");
    const r = await startVoice({ ...body, projectId: video.projectId });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setItem(r.item);
  }

  const max = model?.options.maxVariants ?? 4;
  return (
    <SheetPortal><div className="rd-scrim" onClick={onClose}>
      <div className="vc-as" role="dialog" aria-modal="true" aria-label="Add sound to video" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="rd-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <h2><Volume2 size={18} aria-hidden="true" /> Add sound</h2>
        {!item ? (
          <>
            <video className="vc-st-video" src={video.imageUrl ?? undefined} muted playsInline controls preload="metadata" aria-label="Your video" />
            <label className="vc-as-field">
              <span>Describe the sound (optional)</span>
              <textarea rows={2} value={prompt} maxLength={model?.maxChars ?? 2000} onChange={(e) => { setPrompt(e.target.value); setError(""); }} placeholder="Footsteps on gravel, light wind" />
              <small>{prompt.length.toLocaleString("en-US")}/{(model?.maxChars ?? 2000).toLocaleString("en-US")}</small>
            </label>
            <div className="vc-as-row">
              <button type="button" className={`vc-pill ${speech ? "is-on" : ""}`} aria-pressed={speech} onClick={() => setSpeech((v) => !v)}>Keep speech</button>
              <label className="vc-pill vc-select" title="Variants"><span className="sr-only">Variants</span>
                <select aria-label="Variants" value={variants} onChange={(e) => setVariants(Number(e.target.value))}>{Array.from({ length: max }, (_, i) => i + 1).map((v) => <option key={v} value={v}>{v} {v === 1 ? "variant" : "variants"}</option>)}</select>
              </label>
              {model?.options.formats && model.options.formats.length > 1 && (
                <label className="vc-pill vc-select" title="File format"><span className="sr-only">File format</span>
                  <select aria-label="File format" value={format} onChange={(e) => setFormat(e.target.value)}>{model.options.formats.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}</select>
                </label>
              )}
            </div>
            {error && <p className="vc-error" role="alert">{error}</p>}
            <button type="button" className="vc-as-go" onClick={() => void go()} disabled={busy || !model}>
              {busy ? <Loader2 size={16} className="vc-spin" /> : null} Add sound
              {price != null && <span className="vc-cost"><Coins size={12} />{price}</span>}
            </button>
          </>
        ) : item.status === "pending" ? (
          <p className="vc-as-wait" role="status"><Loader2 size={18} className="vc-spin" /> Making the sound. This usually takes under a minute.</p>
        ) : item.status === "failed" ? (
          <>
            <p className="vc-error" role="alert">{item.error ?? "The sound could not be made."}</p>
            <button type="button" className="vc-pill" onClick={() => setItem(null)}>Try again</button>
          </>
        ) : (
          <>
            <SoundTake item={item} />
            <p className="vc-as-note">Every variant is saved under Voice Studio. Play the video to hear it with the new sound.</p>
          </>
        )}
      </div>
    </div></SheetPortal>
  );
}
