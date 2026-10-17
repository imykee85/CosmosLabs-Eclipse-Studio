"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Film, Loader2, X } from "lucide-react";
import type { AudioItem } from "@/lib/use-voice";
import { cancelSandboxJob, downloadLink, followSandboxJob, startSandboxJob } from "@/lib/sandbox-client";

// A finished take that has alternatives (Mirelo variants) and/or belongs to a video ("Add sound"). Pick a variant with its chip. With a video, the clip plays MUTED and the
// chosen sound plays with it, kept in step (play, pause, seek, end), so the result is heard exactly as it will be used. "Download video with sound" merges the chosen
// variant into the video on a cloud computer (a media.mux sandbox job) and downloads the result; it shows only while that feature is switched on.
export default function SoundTake({ item, compact = false }: { item: AudioItem; compact?: boolean }) {
  const list = item.variants?.length ? item.variants : item.url ? [{ url: item.url, durationMs: item.durationMs, contentType: item.contentType, fileName: item.fileName }] : [];
  const [n, setN] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const chosen = list[Math.min(n, list.length - 1)];
  const hasVideo = !!item.videoUrl;
  const [mux, setMux] = useState<{ id: string | null; busy: boolean; error: string; url: string | null; variant: number }>({ id: null, busy: false, error: "", url: null, variant: 0 });
  const follow = useRef<AbortController | null>(null);
  useEffect(() => () => follow.current?.abort(), []);

  async function withSound() {
    const variant = n + 1;
    if (mux.url && mux.variant === variant) return downloadLink(mux.url);
    setMux({ id: null, busy: true, error: "", url: null, variant });
    const r = await startSandboxJob("media.mux", { audioJobId: item.id, variant });
    if (!r.ok) return setMux((m) => ({ ...m, busy: false, error: r.error }));
    setMux((m) => ({ ...m, id: r.job.id }));
    follow.current?.abort();
    const ctl = (follow.current = new AbortController());
    const end = await followSandboxJob(r.job.id, () => {}, ctl.signal);
    if (ctl.signal.aborted) return;
    const url = end?.status === "succeeded" && typeof end.output?.url === "string" ? end.output.url : null;
    if (url) { setMux({ id: null, busy: false, error: "", url, variant }); downloadLink(url); }
    else setMux((m) => ({ ...m, id: null, busy: false, error: end?.error?.message ?? "The video with sound could not be made. Nothing was charged." }));
  }
  async function stopMux() {
    follow.current?.abort();
    if (mux.id) await cancelSandboxJob(mux.id);
    setMux((m) => ({ ...m, id: null, busy: false }));
  }

  // Switching variant while the clip plays keeps the position and keeps playing.
  useEffect(() => {
    const v = video.current, a = audio.current;
    if (!v || !a || !hasVideo) return;
    a.currentTime = v.currentTime;
    if (!v.paused) void a.play().catch(() => {});
  }, [n, hasVideo]);

  useEffect(() => {
    const v = video.current, a = audio.current;
    if (!v || !a) return;
    const play = () => { a.currentTime = v.currentTime; void a.play().catch(() => {}); };
    const pause = () => a.pause();
    const seek = () => { a.currentTime = v.currentTime; };
    const rate = () => { a.playbackRate = v.playbackRate; };
    v.addEventListener("play", play); v.addEventListener("pause", pause); v.addEventListener("ended", pause); v.addEventListener("seeked", seek); v.addEventListener("ratechange", rate);
    return () => { v.removeEventListener("play", play); v.removeEventListener("pause", pause); v.removeEventListener("ended", pause); v.removeEventListener("seeked", seek); v.removeEventListener("ratechange", rate); };
  }, [hasVideo]);

  if (!chosen?.url) return null;
  return (
    <div className={`vc-st ${compact ? "is-compact" : ""}`}>
      {hasVideo && <video ref={video} className="vc-st-video" src={item.videoUrl!} muted playsInline controls preload="metadata" aria-label="Your video, with the new sound" />}
      <audio ref={audio} className={hasVideo ? "sr-only" : "vc-st-audio"} src={chosen.url} controls={!hasVideo} preload="metadata" />
      <div className="vc-st-row">
        {list.length > 1 && (
          <div className="vc-st-chips" role="group" aria-label="Variants">
            {list.map((_, i) => <button key={i} type="button" className={`vc-pill ${i === n ? "is-on" : ""}`} aria-pressed={i === n} onClick={() => setN(i)}>Variant {i + 1}</button>)}
          </div>
        )}
        <div className="vc-st-actions">
          <a className="vc-pill" href={`/api/audio/${item.id}/file?download=1${list.length > 1 ? `&variant=${n + 1}` : ""}`} download={chosen.fileName}><Download size={14} /> Download sound</a>
          {hasVideo && item.canMux && (
            <>
              <button type="button" className="vc-pill" onClick={() => void withSound()} disabled={mux.busy} aria-busy={mux.busy}>
                {mux.busy ? <Loader2 size={14} className="vc-spin" aria-hidden /> : <Film size={14} />} {mux.busy ? "Making the video" : "Download video with sound"}
              </button>
              {mux.busy && mux.id && <button type="button" className="vc-pill vc-st-x" onClick={() => void stopMux()} aria-label="Cancel"><X size={14} /></button>}
            </>
          )}
        </div>
      </div>
      {mux.error && <p className="vc-st-err" role="alert">{mux.error}</p>}
    </div>
  );
}
