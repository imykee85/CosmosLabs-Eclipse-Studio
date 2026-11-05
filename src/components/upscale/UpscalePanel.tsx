"use client";

import { useEffect, useRef, useState } from "react";
import { X, ZoomIn } from "lucide-react";
import Bar from "../create/Bar";
import GenerateButton from "@/components/GenerateButton";
import { PRESETS, PRESET_HINT, PRESET_LABEL, type Preset } from "@/lib/topaz/models";
import { thumbOf } from "@/lib/thumb-url";
import "./upscale.css";

export type UpscaleSource = { id: string; kind: "image" | "video"; width: number | null; height: number | null; durationSec?: number | null };
type Quote = { ok: true; outW: number; outH: number; credits: number | null } | { ok: false; error: string } | null;

/** Upscale for a finished picture (Image Studio) or clip (Video Studio): the same panel shell as Relight and Change camera. The result is a new item; the original stays. */
export default function UpscalePanel({ source, onClose, onStarted }: { source: UpscaleSource; onClose: () => void; onStarted: (id?: string) => void }) {
  const video = source.kind === "video";
  const [preset, setPreset] = useState<Preset>("auto");
  const [scale, setScale] = useState(2);
  const [target, setTarget] = useState<"1080p" | "4k">(video && (source.height ?? 0) >= 1080 ? "4k" : "1080p");
  const [creativity, setCreativity] = useState(3);
  const [quote, setQuote] = useState<Quote>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const seq = useRef(0);

  useEffect(() => { fetch("/api/upscale/quote").then((r) => (r.ok ? r.json() : null)).then((d) => { setAvailable(!!d?.available); }).catch(() => setAvailable(false)); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose, busy]);

  const body = () => ({ sourceId: source.id, preset, ...(video ? { target } : { scale }), ...(preset === "creative" ? { creativity: video ? creativity / 10 : creativity } : {}) });
  useEffect(() => {
    if (!available) return;
    const mine = ++seq.current; setQuote(null);
    const t = setTimeout(() => {
      fetch("/api/upscale/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body()) })
        .then((r) => r.json()).then((d) => { if (seq.current === mine) setQuote(d?.ok ? d : { ok: false, error: typeof d?.error === "string" ? d.error : "Could not work out the price." }); })
        .catch(() => { if (seq.current === mine) setQuote({ ok: false, error: "Could not work out the price." }); });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, preset, scale, target, source.id]);

  async function run() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/upscale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body()) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(typeof d.error === "string" ? d.error : "Could not start. Please try again."); return; }
      onStarted(d?.item?.id); onClose();
    } catch { setError("Could not reach the server. Check your connection and try again."); } finally { setBusy(false); }
  }

  const ok = quote && quote.ok ? quote : null;
  const note = available === false ? "Upscale isn't available yet." : quote && !quote.ok ? quote.error : "";
  const size = source.width && source.height ? `${source.width} × ${source.height}` : "";
  return (
    <div className="cr-var-back" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="cr-var cr-cam up-panel" role="dialog" aria-modal="true" aria-label="Upscale">
        <div className="cr-var-head">
          {video ? <span className="cr-var-thumb up-thumb"><ZoomIn size={22} /></span> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={thumbOf("render", source.id)} alt="" className="cr-var-thumb" />}
          <div><h2>Upscale</h2><p>{video ? "A sharper, higher-resolution copy of the clip" : "A sharper, higher-resolution copy of the picture"}</p></div>
          <button type="button" className="cr-var-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="cr-light-label">Style</div>
        <div className="cr-light-quick is-three" role="radiogroup" aria-label="Style">
          {PRESETS.map((p) => <button key={p} type="button" role="radio" aria-checked={preset === p} className={preset === p ? "is-on" : ""} onClick={() => setPreset(p)}>{PRESET_LABEL[p]}</button>)}
        </div>
        <p className="up-hint">{PRESET_HINT[source.kind][preset]}</p>

        <div className="cr-light-label">{video ? "Output resolution" : "Size"}</div>
        <div className="cr-light-quick up-sizes" role="radiogroup" aria-label={video ? "Output resolution" : "Size"}>
          {video
            ? (["1080p", "4k"] as const).map((t) => <button key={t} type="button" role="radio" aria-checked={target === t} className={target === t ? "is-on" : ""} onClick={() => setTarget(t)}>{t === "4k" ? "4K" : "1080p"}</button>)
            : [2, 4].map((s) => <button key={s} type="button" role="radio" aria-checked={scale === s} className={scale === s ? "is-on" : ""} onClick={() => setScale(s)}>{s}x</button>)}
        </div>
        {preset === "creative" && <Bar id="up-cr" label="Creativity" min={1} max={9} value={creativity} unit="" onChange={setCreativity} />}

        <div className="up-result" aria-live="polite">
          {size && <span>From {size}</span>}
          {ok && <span>To {ok.outW} × {ok.outH}</span>}
        </div>
        {(note || error) && <div className="cr-var-err" role="alert">{error || note}</div>}
        <div className="cr-cam-actions">
          <GenerateButton wide label="Upscale" busyLabel="Starting" busy={busy} disabled={!ok || available !== true} price={ok ? ok.credits : null} onClick={() => void run()} />
        </div>
      </div>
    </div>
  );
}
