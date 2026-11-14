"use client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { MessageSquarePlus, Pause, Play, Repeat } from "lucide-react";
import { FRAME_URL, MotionHost, PreviewClips, type LoadSpec } from "@/lib/design/motion/client";
import type { MotionAudio, MotionComment } from "@/lib/design/motion/spec";

export type PlayerHandle = { host: () => MotionHost | null; time: () => number; seek: (t: number) => void; pause: () => void };
type Props = {
  spec: LoadSpec | null; audio?: MotionAudio | null; comments?: MotionComment[]; compact?: boolean;
  commenting?: boolean; onPin?: (p: { t: number; x: number; y: number }) => void; onError?: (msg: string | null) => void;
  syncTime?: number | null; onTime?: (t: number) => void; playing?: boolean; onPlaying?: (p: boolean) => void;
};

const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

// The live preview of one version: a sandboxed frame draws every moment the transport asks for; the sound files play in step with it.
const MotionPlayer = forwardRef<PlayerHandle, Props>(function MotionPlayer(p, ref) {
  const frame = useRef<HTMLIFrameElement>(null), host = useRef<MotionHost | null>(null);
  const [t, setT] = useState(0), [playing, setPlaying] = useState(false), [loop, setLoop] = useState(true), [err, setErr] = useState<string | null>(null);
  const tRef = useRef(0), raf = useRef(0), audios = useRef<HTMLAudioElement[]>([]);
  const deck = useRef<PreviewClips | null>(null), busyClip = useRef(false), wantT = useRef<number | null>(null);
  // Draws moment t: with clips, their frames are read first (one at a time; a newer moment asked meanwhile replaces the waiting one).
  const draw = useCallback((t: number, playing = false) => {
    const d = deck.current;
    if (!d || !d.size) { host.current?.seek(t); return; }
    wantT.current = t;
    if (busyClip.current) return;
    busyClip.current = true;
    const run = async () => {
      while (wantT.current != null) {
        const at = wantT.current; wantT.current = null;
        const vf = await d.frames(at, playing).catch(() => undefined);
        if (deck.current === d) host.current?.seek(at, vf);
      }
      busyClip.current = false;
    };
    void run();
  }, []);
  const dur = p.spec?.duration ?? 10;
  const playingNow = p.playing ?? playing;
  const setPlay = useCallback((v: boolean) => { if (p.onPlaying) p.onPlaying(v); else setPlaying(v); }, [p]);

  useEffect(() => {
    const h = new MotionHost(frame.current!); host.current = h;
    h.listener = (m) => { if (m.type === "error") { const msg = `${m.where === "compile" ? "The motion did not start" : "The motion stopped drawing"}: ${m.message}`; setErr(msg); p.onError?.(msg); } else if (m.type === "ready") { setErr(null); p.onError?.(null); } };
    return () => { h.dispose(); host.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const clipKey = (p.spec?.clips ?? []).map((c) => `${c.id}:${c.duration}`).join(",");
  useEffect(() => {
    deck.current?.dispose();
    deck.current = p.spec?.clips?.length ? new PreviewClips(p.spec.clips) : null;
    return () => { deck.current?.dispose(); deck.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipKey]);
  useEffect(() => { if (p.spec) void host.current?.load(p.spec, tRef.current).then(() => { if (deck.current) draw(tRef.current); }); }, [p.spec, draw]);

  // The sound files of a finished version, played in step with the picture.
  useEffect(() => {
    audios.current.forEach((a) => a.pause());
    audios.current = (["music", "voice", "sfx"] as const).flatMap((k) => {
      const part = p.audio?.[k];
      if (!part?.jobId || part.status !== "done") return [];
      const a = new Audio(`/api/audio/${part.jobId}/file`); a.preload = "auto"; a.volume = k === "music" ? 0.55 : 1; return [a];
    });
    return () => audios.current.forEach((a) => a.pause());
  }, [p.audio]);

  const seek = useCallback((x: number) => {
    const v = Math.max(0, Math.min(dur, x)); tRef.current = v; setT(v); draw(v); p.onTime?.(v);
    audios.current.forEach((a) => { try { a.currentTime = v; } catch { /* not loaded yet */ } });
  }, [dur, p, draw]);
  useImperativeHandle(ref, () => ({ host: () => host.current, time: () => tRef.current, seek, pause: () => setPlay(false) }), [seek, setPlay]);
  useEffect(() => { if (p.syncTime != null && Math.abs(p.syncTime - tRef.current) > 0.02) { tRef.current = p.syncTime; setT(p.syncTime); draw(p.syncTime); } }, [p.syncTime, draw]);

  useEffect(() => {
    if (!playingNow) { audios.current.forEach((a) => a.pause()); deck.current?.pause(); return; }
    if (tRef.current >= dur - 0.01) seek(0);
    deck.current?.play(tRef.current);
    audios.current.forEach((a) => { try { a.currentTime = tRef.current; void a.play().catch(() => {}); } catch { /* ignore */ } });
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      let nt = tRef.current + dt;
      if (nt >= dur) {
        if (loop) { nt = 0; audios.current.forEach((a) => { a.currentTime = 0; void a.play().catch(() => {}); }); }
        else { nt = dur; tRef.current = nt; setT(nt); draw(nt); p.onTime?.(nt); setPlay(false); return; }
      }
      tRef.current = nt; setT(nt); draw(nt, true); p.onTime?.(nt);
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingNow, dur, loop]);

  const [w, h] = (p.spec?.aspect ?? "16:9").split(":").map(Number);
  const near = (p.comments ?? []).filter((c) => !c.used && Math.abs(c.t - t) < 0.75);
  return (
    <div className={`mt-player${p.compact ? " is-compact" : ""}`}>
      <div className="mt-stage" style={{ aspectRatio: `${w} / ${h}` }}>
        <iframe ref={frame} src={FRAME_URL} title="Motion preview" sandbox="allow-scripts" className="mt-frame" />
        {p.commenting && <button type="button" className="mt-pinlayer" aria-label="Click to pin a comment here" onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect(); setPlay(false);
          p.onPin?.({ t: tRef.current, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
        }} />}
        {near.map((c) => <span key={c.id} className="mt-pin" style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }} title={c.text}><MessageSquarePlus size={12} /></span>)}
        {err && <div className="mt-err" role="alert">{err}</div>}
        {!p.spec && <div className="mt-blank" />}
      </div>
      {!p.compact && (
        <div className="mt-transport">
          <button type="button" aria-label={playingNow ? "Pause" : "Play"} onClick={() => setPlay(!playingNow)} disabled={!p.spec}>{playingNow ? <Pause size={16} /> : <Play size={16} />}</button>
          <span className="mt-time">{fmt(t)} / {fmt(dur)}</span>
          <div className="mt-scrub">
            <input type="range" min={0} max={dur} step={0.01} value={t} aria-label="Time" onChange={(e) => { setPlay(false); seek(Number(e.target.value)); }} disabled={!p.spec} />
            {(p.comments ?? []).filter((c) => !c.used).map((c) => <i key={c.id} className="mt-mark" style={{ left: `${(c.t / dur) * 100}%` }} title={c.text} />)}
          </div>
          <button type="button" className={loop ? "is-on" : ""} aria-pressed={loop} aria-label="Loop" onClick={() => setLoop(!loop)}><Repeat size={15} /></button>
        </div>
      )}
    </div>
  );
});
export default MotionPlayer;
