"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import type { AudioItem } from "@/lib/use-voice";

// A finished take that has alternatives (Mirelo variants) and/or belongs to a video ("Add sound"). Pick a variant with its chip. With a video, the clip plays MUTED and the
// chosen sound plays with it, kept in step (play, pause, seek, end), so the result is heard exactly as it will be used; there is no merged file yet (see the notes).
export default function SoundTake({ item, compact = false }: { item: AudioItem; compact?: boolean }) {
  const list = item.variants?.length ? item.variants : item.url ? [{ url: item.url, durationMs: item.durationMs, contentType: item.contentType, fileName: item.fileName }] : [];
  const [n, setN] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const chosen = list[Math.min(n, list.length - 1)];
  const hasVideo = !!item.videoUrl;

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
        <a className="vc-pill" href={`/api/audio/${item.id}/file?download=1${list.length > 1 ? `&variant=${n + 1}` : ""}`} download={chosen.fileName}><Download size={14} /> Download sound</a>
      </div>
    </div>
  );
}
