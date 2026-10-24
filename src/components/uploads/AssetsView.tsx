"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Music, Plus, Trash2, X } from "lucide-react";
import { readCurrentProject } from "@/lib/projects";
import { deleteUpload, uploadPicture, uploadVideo, useUploads, type UploadRow } from "@/lib/use-uploads";
import { uploadAudio, AUDIO_LIMIT_MB, VIDEO_LIMIT_MB } from "@/lib/direct-upload-client";
import { attachKind } from "@/lib/attach-file";
import { PICK_LIMIT_BYTES, shrinkToFit } from "@/lib/shrink-image";
import { fallbackTo, thumbOf } from "@/lib/thumb-url";
import type { Render } from "@/lib/use-renders";
import type { AudioItem } from "@/lib/audio/jobs";
import "@/components/library/library.css";
import "./uploads.css";

// Assets (owner 2026-10-19: "should take videos and audio too, basically all media"): everything the person added from their device, in one place.
// Pictures are Upload rows, videos are the person's own uploaded videos (Generation rows marked uploaded), sounds are audio rows of kind "upload".
// All three can then be used as ingredients: pictures and videos in Image and Video Studio, sounds as reference audio in Video Studio.
type Filter = "all" | "pictures" | "videos" | "audio";
const FILTERS: { id: Filter; label: string }[] = [{ id: "all", label: "All" }, { id: "pictures", label: "Pictures" }, { id: "videos", label: "Videos" }, { id: "audio", label: "Audio" }];
const size = (n: number | null | undefined) => (!n ? null : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const secs = (s: number | null | undefined) => (s == null ? null : s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : `${Math.round(s)} s`);
const PICTURE = ["image/png", "image/jpeg", "image/webp"];
const VIDEO = ["video/mp4", "video/quicktime", "video/webm"];
const isAudio = (f: File) => f.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg)$/i.test(f.name);

export default function AssetsView() {
  const [filter, setFilter] = useState<Filter>("all");
  const pictures = useUploads("asset");
  const [videos, setVideos] = useState<Render[] | null>(null);
  const [sounds, setSounds] = useState<AudioItem[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadVideos = useCallback(async () => {
    try { const r = await fetch("/api/generations?uploaded=1&limit=100", { cache: "no-store" }); const d = r.ok ? await r.json() : { items: [] }; setVideos((Array.isArray(d.items) ? d.items : []).filter((v: Render) => v.status === "completed")); } catch { setVideos((v) => v ?? []); }
  }, []);
  const loadSounds = useCallback(async () => {
    try { const r = await fetch("/api/audio?kind=upload", { cache: "no-store" }); const d = r.ok ? await r.json() : { items: [] }; setSounds(Array.isArray(d.items) ? d.items : []); } catch { setSounds((v) => v ?? []); }
  }, []);
  useEffect(() => { void loadVideos(); void loadSounds(); }, [loadVideos, loadSounds]);

  async function removePicture(u: UploadRow) {
    if (!window.confirm(`Delete “${u.name}” for good? This cannot be undone.`)) return;
    setBusyId(u.id);
    const ok = await deleteUpload(u.id);
    setBusyId(null);
    if (ok) void pictures.reload(); else setError("Could not delete that picture. Please try again.");
  }
  async function binVideo(v: Render) {
    if (!window.confirm(`Move “${v.prompt || "this video"}” to the Bin?`)) return;
    setBusyId(v.id);
    const r = await fetch(`/api/generations/${v.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "trash" }) }).catch(() => null);
    setBusyId(null);
    if (r?.ok) void loadVideos(); else setError("Could not move that video to the Bin. Please try again.");
  }
  async function binSound(a: AudioItem) {
    if (!window.confirm(`Move “${a.text || "this sound"}” to the Bin?`)) return;
    setBusyId(a.id);
    const r = await fetch(`/api/audio/${a.id}`, { method: "DELETE" }).catch(() => null);
    setBusyId(null);
    if (r?.ok) void loadSounds(); else setError("Could not move that sound to the Bin. Please try again.");
  }

  const showPics = filter === "all" || filter === "pictures";
  const showVids = filter === "all" || filter === "videos";
  const showAudio = filter === "all" || filter === "audio";
  const pics = showPics ? pictures.items ?? [] : [];
  const vids = showVids ? videos ?? [] : [];
  const auds = showAudio ? (sounds ?? []).filter((a) => a.status === "completed" && a.url) : [];
  const loaded = pictures.items !== null && videos !== null && sounds !== null;
  const empty = loaded && !pics.length && !vids.length && !auds.length;

  return (
    <div className="up">
      <div className="up-bar">
        <button type="button" className="ws-add up-add" onClick={() => setAdding(true)}><Plus size={16} /> Upload</button>
        <div className="lib-roles" role="group" aria-label="Show">
          {FILTERS.map((f) => <button key={f.id} type="button" aria-pressed={filter === f.id} className={filter === f.id ? "is-active" : ""} onClick={() => setFilter(f.id)}>{f.label}</button>)}
        </div>
      </div>
      {(error || pictures.error) && <p className="up-error" role="alert">{error || pictures.error}</p>}
      {empty && (
        <section className="ws-ing-empty">
          <h2>{filter === "all" ? "No assets yet" : `No ${filter} yet`}</h2>
          <p>Pictures, videos and sounds you upload appear here, ready to use in every studio.</p>
        </section>
      )}
      {!empty && (
        <div className="up-grid">
          {pics.map((u) => (
            <figure key={`p-${u.id}`} className="up-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbOf("upload", u.id)} onError={fallbackTo(u.imageUrl)} alt={u.name} loading="lazy" decoding="async" />
              <figcaption><strong>{u.name}</strong><span>{["Picture", u.width && u.height ? `${u.width}×${u.height}` : null, size(u.sizeBytes)].filter(Boolean).join(" · ")}</span></figcaption>
              <button type="button" className="up-del" disabled={busyId === u.id} onClick={() => removePicture(u)} aria-label={`Delete ${u.name}`}><Trash2 size={15} /></button>
            </figure>
          ))}
          {vids.map((v) => (
            <figure key={`v-${v.id}`} className="up-tile">
              {v.imageUrl ? <video className="up-media" src={v.imageUrl} muted loop autoPlay playsInline preload="metadata" /> : <span className="up-media" />}
              <figcaption><strong>{v.prompt || "Video"}</strong><span>{["Video", secs(v.durationSec), size(v.sizeBytes)].filter(Boolean).join(" · ")}</span></figcaption>
              <button type="button" className="up-del" disabled={busyId === v.id} onClick={() => binVideo(v)} aria-label={`Move ${v.prompt || "video"} to the Bin`}><Trash2 size={15} /></button>
            </figure>
          ))}
          {auds.map((a) => (
            <figure key={`a-${a.id}`} className="up-tile">
              <div className="up-media up-sound"><Music size={34} strokeWidth={1.5} aria-hidden="true" /><audio controls preload="none" src={a.url!} /></div>
              <figcaption><strong>{a.text || "Sound"}</strong><span>{["Audio", secs(a.durationMs ? a.durationMs / 1000 : null), size(a.sizeBytes)].filter(Boolean).join(" · ")}</span></figcaption>
              <button type="button" className="up-del" disabled={busyId === a.id} onClick={() => binSound(a)} aria-label={`Move ${a.text || "sound"} to the Bin`}><Trash2 size={15} /></button>
            </figure>
          ))}
        </div>
      )}
      {adding && <AddMediaDialog onClose={() => setAdding(false)} onDone={(k) => { setAdding(false); if (k === "picture") void pictures.reload(); else if (k === "video") void loadVideos(); else void loadSounds(); }} />}
    </div>
  );
}

type MediaKind = "picture" | "video" | "audio";
function AddMediaDialog({ onClose, onDone }: { onClose: () => void; onDone: (k: MediaKind) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<MediaKind | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [rights, setRights] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function pick(f: File | undefined) {
    setErr(null);
    if (!f) return;
    let k: MediaKind | null = null;
    if (attachKind(f) === "picture") {
      if (f.size > PICK_LIMIT_BYTES) { setErr("That picture is larger than 50 MB. Please use a smaller one."); return; }
      const fitted = await shrinkToFit(f);
      if (!fitted) { setErr("Could not make that picture small enough. Please try another."); return; }
      f = fitted; k = "picture";
    } else if (attachKind(f) === "video") {
      if (f.size > VIDEO_LIMIT_MB * 1048576) { setErr(`That video is larger than ${VIDEO_LIMIT_MB} MB.`); return; }
      k = "video";
    } else if (isAudio(f)) {
      if (f.size > AUDIO_LIMIT_MB * 1048576) { setErr(`That sound file is larger than ${AUDIO_LIMIT_MB} MB.`); return; }
      k = "audio";
    } else { setErr("Assets holds pictures, videos and sounds. Documents go into a chat (Atlas, Core, Prompts or Treatment)."); return; }
    setFile(f); setKind(k);
    if (!name.trim()) setName(f.name.replace(/\.[^.]+$/, "").slice(0, 80));
  }

  async function submit() {
    if (!file || !kind || busy) return;
    setBusy(true); setErr(null); setProgress(0);
    const project = readCurrentProject()?.id ?? null;
    const label = name.trim() || "Asset";
    const r = kind === "picture" ? await uploadPicture(file, "asset", label, project, setProgress)
      : kind === "video" ? await uploadVideo(file, label, project, setProgress)
      : await uploadAudio(file, label, project, setProgress);
    setBusy(false); setProgress(null);
    if (r.ok) onDone(kind); else setErr(r.error);
  }

  return (
    <div className="rd-scrim" onClick={() => !busy && onClose()}>
      <div className="up-dialog" role="dialog" aria-modal="true" aria-label="Upload an asset" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="rd-close" onClick={onClose} disabled={busy} aria-label="Close"><X size={18} /></button>
        <h2>Upload an asset</h2>
        <button type="button" className="up-drop" onClick={() => input.current?.click()} disabled={busy}>
          {preview && kind === "picture" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Chosen picture" />
          ) : preview && kind === "video" ? <video src={preview} muted playsInline autoPlay loop />
            : preview && kind === "audio" ? <span><Music size={30} strokeWidth={1.5} /><small>{file?.name}</small></span>
            : <span>Choose a file<small>Pictures (PNG, JPEG, WebP), videos (MP4, MOV, WebM) or sounds (MP3, WAV, M4A, OGG).</small></span>}
        </button>
        <input ref={input} type="file" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        <label className="up-field">
          <span>Name</span>
          <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Front view" />
        </label>
        <label className="up-rights">
          <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} />
          <span>I have the right to use this file, and it is not someone&apos;s likeness or voice used to deceive.</span>
        </label>
        {err && <p className="up-error" role="alert">{err}</p>}
        <button type="button" className="ws-add" disabled={!file || !rights || busy} onClick={submit}>{busy ? (progress != null && progress < 1 ? `Uploading… ${Math.round(progress * 100)}%` : "Checking…") : "Upload"}</button>
      </div>
    </div>
  );
}
