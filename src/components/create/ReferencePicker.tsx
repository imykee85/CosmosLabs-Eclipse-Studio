"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Upload, X } from "lucide-react";
import { AddDialog } from "@/components/uploads/UploadPanel";
import { useRenders } from "@/lib/use-renders";
import { uploadVideo, useUploads } from "@/lib/use-uploads";
import { readCurrentProject } from "@/lib/projects";
import { VIDEO_LIMIT_MB } from "@/lib/direct-upload-client";
import "@/components/library/library.css";
import "@/components/uploads/uploads.css";
import { fallbackTo, thumbOf } from "@/lib/thumb-url";

// A reference picture the user chose: one of their uploads (Ingredients, Assets) or one of their finished renders.
export type RefPick = { type: "upload" | "render"; id: string; url: string; label: string };

// A reference clip: one of the person's own finished videos, with its recorded length (seconds; motion transfer prices and checks by it).
export type ClipPick = RefPick & { sec?: number | null };
// A reference sound: one of the person's own finished Audio Studio takes (voice, sound effect or music).
export type SoundPick = { id: string; label: string; url: string };

type Tab = "ingredients" | "assets" | "images" | "videos" | "audio";
const TABS: { id: Tab; label: string }[] = [{ id: "ingredients", label: "Ingredients" }, { id: "assets", label: "Assets" }, { id: "images", label: "My images" }];
const VIDEO_TAB: { id: Tab; label: string } = { id: "videos", label: "My videos" };
const AUDIO_TAB: { id: Tab; label: string } = { id: "audio", label: "My audio" };

// Dialog for choosing up to `max` pictures to send to the model along with the prompt. Video models can also take the person's own finished videos: they are
// the last tab ("My videos", up to `videoMax`); `videosOnly` shows just that tab (motion transfer, or a model whose references are clips only).
export default function ReferencePicker({ max, picked, onChange, onClose, videoMax = 0, pickedVideos = [], onVideosChange, videosOnly = false, note, audioMax = 0, pickedAudio = [], onAudioChange }: {
  max: number; picked: RefPick[]; onChange: (next: RefPick[]) => void; onClose: () => void;
  videoMax?: number; pickedVideos?: ClipPick[]; onVideosChange?: (next: ClipPick[]) => void; videosOnly?: boolean;
  audioMax?: number; pickedAudio?: SoundPick[]; onAudioChange?: (next: SoundPick[]) => void; // a model that takes reference sounds (Seedance): the "My audio" tab
  note?: string; // replaces the usual line under the heading
}) {
  const withVideos = videoMax > 0 && !!onVideosChange;
  const withAudio = audioMax > 0 && !!onAudioChange && !videosOnly;
  const tabs = videosOnly ? [VIDEO_TAB] : [...TABS, ...(withVideos ? [VIDEO_TAB] : []), ...(withAudio ? [AUDIO_TAB] : [])];
  const [sounds, setSounds] = useState<{ id: string; label: string; sub: string; url: string }[] | null>(null);
  useEffect(() => {
    if (!withAudio) return;
    let live = true;
    fetch("/api/audio", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { items: [] })).then((d) => {
      if (!live) return;
      const list = (Array.isArray(d.items) ? d.items : []) as { id: string; kind: string; status: string; url?: string | null; text?: string | null; modelLabel?: string; voiceName?: string | null }[];
      setSounds(list.filter((a) => a.status === "completed" && a.url && (a.kind === "tts" || a.kind === "sfx" || a.kind === "music" || a.kind === "upload")).map((a) => ({ id: a.id, label: (a.text ?? "").slice(0, 60) || a.modelLabel || "Sound", sub: a.kind === "tts" ? `Voice${a.voiceName ? ` · ${a.voiceName}` : ""}` : a.kind === "sfx" ? "Sound effect" : a.kind === "upload" ? "Your audio" : "Music", url: a.url! })));
    }).catch(() => { if (live) setSounds([]); });
    return () => { live = false; };
  }, [withAudio]);
  const hasSound = (id: string) => pickedAudio.some((a) => a.id === id);
  function toggleSound(a: SoundPick) {
    if (!onAudioChange) return;
    if (hasSound(a.id)) onAudioChange(pickedAudio.filter((x) => x.id !== a.id));
    else if (pickedAudio.length < audioMax) onAudioChange([...pickedAudio, a]);
  }
  const [tab, setTab] = useState<Tab>(videosOnly ? "videos" : "ingredients");
  const [adding, setAdding] = useState(false);
  const knownIds = useRef<Set<string> | null>(null); // ids present before an upload, to spot the new one
  const ingredients = useUploads("ingredients");
  const assets = useUploads("asset");
  const { renders, reload: reloadRenders } = useRenders(undefined, 60);
  const [vProgress, setVProgress] = useState<number | null>(null); // upload of a video from the device (0 to 1)
  const [vError, setVError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const has = (type: RefPick["type"], id: string) => picked.some((p) => p.type === type && p.id === id);
  function toggle(item: RefPick) {
    if (has(item.type, item.id)) onChange(picked.filter((p) => !(p.type === item.type && p.id === item.id)));
    else if (max === 1) onChange([item]); // a single choice swaps the previous one
    else if (picked.length < max) onChange([...picked, item]);
  }

  const hasVideo = (id: string) => pickedVideos.some((p) => p.id === id);
  function toggleVideo(g: { id: string; url: string; label: string; sec: number | null }) {
    if (!onVideosChange) return;
    if (hasVideo(g.id)) onVideosChange(pickedVideos.filter((p) => p.id !== g.id));
    else if (videoMax === 1) onVideosChange([{ type: "render", id: g.id, url: g.url, label: g.label, sec: g.sec }]); // a single choice swaps the previous one
    else if (pickedVideos.length < videoMax) onVideosChange([...pickedVideos, { type: "render", id: g.id, url: g.url, label: g.label, sec: g.sec }]);
  }
  async function pickVideoFile(f: File | undefined) {
    if (!f) return;
    setVError("");
    if (f.size > VIDEO_LIMIT_MB * 1024 * 1024) { setVError(`That video is larger than ${VIDEO_LIMIT_MB} MB. Please use a smaller one.`); return; }
    setVProgress(0);
    const r = await uploadVideo<{ id: string; imageUrl?: string | null; prompt: string; durationSec?: number | null }>(f, f.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Uploaded video", readCurrentProject()?.id ?? null, setVProgress);
    setVProgress(null);
    if (!r.ok) { setVError(r.error); return; }
    await reloadRenders?.();
    toggleVideo({ id: r.item.id, url: r.item.imageUrl ?? "", label: r.item.prompt, sec: r.item.durationSec ?? null });
  }
  const videos = (renders ?? []).filter((g) => g.kind === "video" && g.status === "completed" && g.imageUrl);

  const items: (RefPick & { sub: string })[] =
    tab === "videos" ? [] : tab === "images"
      ? (renders ?? []).filter((g) => g.status === "completed" && g.imageUrl && g.kind !== "video").map((g) => ({ type: "render" as const, id: g.id, url: g.imageUrl ?? "", label: g.prompt, sub: g.modelLabel ?? "Image" }))
      : ((tab === "ingredients" ? ingredients.items : assets.items) ?? []).map((u) => ({ type: "upload" as const, id: u.id, url: u.imageUrl, label: u.name, sub: u.kind === "asset" ? "Asset" : u.kind[0].toUpperCase() + u.kind.slice(1) }));
  // After a new upload, tick the new picture (the first one that was not in the list before) if there is room.
  useEffect(() => {
    const known = knownIds.current;
    if (!known) return;
    const fresh = [...(ingredients.items ?? []), ...(assets.items ?? [])].find((u) => !known.has(u.id));
    if (!fresh) return;
    knownIds.current = null;
    if (picked.length < max) onChange([...picked, { type: "upload", id: fresh.id, url: fresh.imageUrl, label: fresh.name }]);
  }, [ingredients.items, assets.items]); // eslint-disable-line react-hooks/exhaustive-deps
  const loading = tab === "images" || tab === "videos" ? renders === null : (tab === "ingredients" ? ingredients.items : assets.items) === null;
  const error = tab === "ingredients" ? ingredients.error : tab === "assets" ? assets.error : null;

  return (
    <div className="rd-scrim" onClick={onClose}>
      <div className="up-dialog rp-dialog" role="dialog" aria-modal="true" aria-label="Choose ingredients" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="rd-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <h2>Choose ingredients</h2>
        {note ? (
          <p className="rp-note">{note}</p>
        ) : videosOnly ? (
          <p className="rp-note">Choose up to {videoMax} of your finished videos. The model follows them for your prompt (call them video 1, video 2…). <b>{pickedVideos.length} of {videoMax}</b> chosen.</p>
        ) : (
          <p className="rp-note">Choose up to {max} pictures{withVideos ? ` and ${videoMax} of your videos` : ""}{withAudio ? ` and ${audioMax} sounds` : ""}. The model uses them as a starting point for your prompt. <b>{picked.length} of {max}</b> pictures{withVideos ? <>, <b>{pickedVideos.length} of {videoMax}</b> videos</> : null}{withAudio ? <>, <b>{pickedAudio.length} of {audioMax}</b> sounds</> : null} chosen.</p>
        )}
        <div className="lib-roles" role="tablist" aria-label="Where from">
          {tabs.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "is-active" : ""} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </div>
        {error && <p className="up-error" role="alert">{error}</p>}
        {tab === "audio" ? (
          sounds === null ? <p className="rp-note">Loading…</p> : sounds.length === 0 ? <p className="rp-note">You have no voices, sounds or music yet. Make them in Audio Studio.</p> : (
            <ul className="rp-sounds">
              {sounds.map((a) => {
                const on = hasSound(a.id);
                return (
                  <li key={a.id} className={on ? "is-on" : ""}>
                    <button type="button" aria-pressed={on} disabled={!on && pickedAudio.length >= audioMax} onClick={() => toggleSound({ id: a.id, label: a.label, url: a.url })}>
                      <span className="rp-sound-check">{on && <Check size={13} />}</span><span className="rp-name">{a.label}</span><small>{a.sub}</small>
                    </button>
                    <audio controls preload="none" src={a.url} />
                  </li>
                );
              })}
            </ul>
          )
        ) : tab === "videos" ? (
          loading ? <p className="rp-note">Loading…</p> : videos.length === 0 ? <p className="rp-note">You have no videos yet. Make one in Video Studio, or upload one below.</p> : (
            <div className="rp-grid">
              {videos.map((g) => {
                const on = hasVideo(g.id);
                return (
                  <button key={g.id} type="button" className={`rp-item ${on ? "is-on" : ""}`} aria-pressed={on} disabled={!on && videoMax > 1 && pickedVideos.length >= videoMax} onClick={() => toggleVideo({ id: g.id, url: g.imageUrl ?? "", label: g.prompt, sec: g.durationSec ?? null })} title={g.prompt}>
                    <video src={g.imageUrl ?? undefined} muted playsInline preload="metadata" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", border: `2px solid ${on ? "#c00707" : "var(--a-line2)"}`, borderRadius: 16, background: "var(--a-card)" }} />
                    {on && <span className="rp-check"><Check size={14} /></span>}
                    <span className="rp-name">{g.prompt}</span><small>{g.modelLabel ?? "Video"}</small>
                  </button>
                );
              })}
            </div>
          )
        ) : loading ? <p className="rp-note">Loading…</p> : items.length === 0 ? (
          <p className="rp-note">{tab === "images" ? "You have no finished images yet." : `Nothing here yet. Add pictures on the ${tab === "ingredients" ? "Ingredients" : "Assets"} page.`}</p>
        ) : (
          <div className="rp-grid">
            {items.map((it) => {
              const on = has(it.type, it.id);
              return (
                <button key={`${it.type}-${it.id}`} type="button" className={`rp-item ${on ? "is-on" : ""}`} aria-pressed={on} disabled={!on && max > 1 && picked.length >= max} onClick={() => toggle(it)} title={it.label}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbOf(it.type, it.id)} onError={fallbackTo(it.url)} alt={it.label} loading="lazy" decoding="async" />
                  {on && <span className="rp-check"><Check size={14} /></span>}
                  <span className="rp-name">{it.label}</span><small>{it.sub}</small>
                </button>
              );
            })}
          </div>
        )}
        {tab === "videos" && (
          <>
            <label className={`rp-upload ${vProgress !== null ? "is-busy" : ""}`} style={{ cursor: vProgress !== null ? "default" : "pointer" }}>
              <Upload size={15} /> {vProgress === null ? "Upload a video" : vProgress < 1 ? `Uploading ${Math.round(vProgress * 100)}%` : "Checking the video…"}
              <input type="file" hidden disabled={vProgress !== null || (videoMax > 0 && pickedVideos.length >= videoMax && videoMax > 1)} onChange={(e) => { void pickVideoFile(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            {vError && <p className="up-error" role="alert">{vError}</p>}
          </>
        )}
        {tab !== "images" && tab !== "videos" && <button type="button" className="rp-upload" onClick={() => setAdding(true)} disabled={picked.length >= max}><Upload size={15} /> Upload a new picture</button>}
        <button type="button" className="ws-add" onClick={onClose}>Done</button>
        {adding && <AddDialog kinds={tab === "ingredients" ? ["character", "product", "scene"] : ["asset"]} initial={tab === "ingredients" ? "product" : "asset"} onClose={() => setAdding(false)} onDone={() => { setAdding(false); knownIds.current = new Set([...(ingredients.items ?? []), ...(assets.items ?? [])].map((u) => u.id)); void ingredients.reload(); void assets.reload(); }} />}
      </div>
    </div>
  );
}
