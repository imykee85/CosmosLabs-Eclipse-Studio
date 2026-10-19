"use client";

// Big files go from the browser straight to storage (see src/lib/direct-upload.ts for the server side). `unavailable` means the browser could not reach
// storage at all (usually the bucket's CORS rule does not allow this site yet), so the caller may fall back to the small-file path.
export type DirectResult<T> = { ok: true; item: T } | { ok: false; error: string; unavailable?: boolean };
export const IMAGE_LIMIT_MB = 50;
export const VIDEO_LIMIT_MB = 500;

function put(url: string, file: File, onProgress?: (fraction: number) => void): Promise<{ ok: boolean; status: number }> {
  return new Promise((resolve) => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    x.setRequestHeader("Content-Type", file.type);
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    x.onload = () => resolve({ ok: x.status >= 200 && x.status < 300, status: x.status });
    x.onerror = () => resolve({ ok: false, status: 0 });
    x.send(file);
  });
}

export async function uploadDirect<T>(file: File, fileKind: "image" | "video", meta: { kind?: string; name: string; projectId: string | null }, onProgress?: (fraction: number) => void): Promise<DirectResult<T>> {
  try {
    const start = await fetch("/api/uploads/direct/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileKind, contentType: file.type, size: file.size }) });
    const s = await start.json().catch(() => null);
    if (!start.ok || !s?.url) return { ok: false, error: s?.error ?? "Could not start the upload.", unavailable: start.status === 503 };
    const sent = await put(s.url, file, onProgress);
    if (!sent.ok) return { ok: false, unavailable: sent.status === 0, error: sent.status === 0 ? "Could not reach storage. Large uploads need the owner to allow this site in the storage bucket's CORS settings." : `The upload was refused (${sent.status}). Please try again.` };
    onProgress?.(1);
    const fin = await fetch("/api/uploads/direct/finish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileKind, key: s.key, kind: meta.kind, name: meta.name, projectId: meta.projectId, rights: true }) });
    const f = await fin.json().catch(() => null);
    if (!fin.ok) return { ok: false, error: f?.error ?? "The file could not be checked. Please try again." };
    return { ok: true, item: f as T };
  } catch {
    return { ok: false, error: "Could not upload that file. Check your connection." };
  }
}

export const AUDIO_LIMIT_MB = 100;
const AUDIO_TYPES: Record<string, string> = { mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", aac: "audio/mp4", ogg: "audio/ogg" };
// The length of a sound file, read by the browser (null when it cannot tell).
function audioLength(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    const done = (v: number | null) => { URL.revokeObjectURL(url); resolve(v); };
    a.preload = "metadata";
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) && a.duration > 0 ? Math.round(a.duration * 1000) : null);
    a.onerror = () => done(null);
    window.setTimeout(() => done(null), 8000);
    a.src = url;
  });
}
// A sound from the device (MP3, WAV, M4A or OGG) for Assets: straight to storage, then checked and kept as one of the person's sounds.
export async function uploadAudio<T>(file: File, name: string, projectId: string | null, onProgress?: (fraction: number) => void): Promise<DirectResult<T>> {
  try {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const type = (file.type || AUDIO_TYPES[ext] || "").toLowerCase();
    const durationMs = await audioLength(file);
    const start = await fetch("/api/audio/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step: "start", contentType: type, size: file.size }) });
    const s = await start.json().catch(() => null);
    if (!start.ok || !s?.url) return { ok: false, error: s?.error ?? "Could not start the upload.", unavailable: start.status === 503 };
    const sent = await put(s.url, new File([file], file.name, { type }), onProgress);
    if (!sent.ok) return { ok: false, unavailable: sent.status === 0, error: sent.status === 0 ? "Could not reach storage. Please try again in a moment." : `The upload was refused (${sent.status}). Please try again.` };
    onProgress?.(1);
    const fin = await fetch("/api/audio/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step: "finish", key: s.key, name, durationMs, projectId }) });
    const f = await fin.json().catch(() => null);
    if (!fin.ok || !f?.item) return { ok: false, error: f?.error ?? "The file could not be checked. Please try again." };
    return { ok: true, item: f.item as T };
  } catch {
    return { ok: false, error: "Could not upload that file. Check your connection." };
  }
}
