"use client";

import { useCallback, useEffect, useState } from "react";
import { uploadDirect } from "./direct-upload-client";
import { redrawToFit } from "./shrink-image";
import type { UploadKind } from "./uploads";

export type UploadRow = { id: string; kind: UploadKind; name: string; projectId: string | null; contentType: string; sizeBytes: number; width: number | null; height: number | null; imageUrl: string; createdAt: string };

// The signed-in user's uploaded pictures. kind: one kind, or "ingredients" for character + product + scene; omit for all.
export function useUploads(kind?: UploadKind | "ingredients") {
  const [items, setItems] = useState<UploadRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/uploads${kind ? `?kind=${kind}` : ""}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error ?? "Could not load your uploads."); setItems([]); return; }
      setError(null);
      setItems(data.items as UploadRow[]);
    } catch {
      setError("Could not load your uploads."); setItems([]);
    }
  }, [kind]);

  useEffect(() => { void reload(); }, [reload]);
  return { items, error, reload };
}

const SMALL_LIMIT = 4 * 1024 * 1024; // what the host takes in one request to our own server

export async function uploadPicture(file: File, kind: UploadKind, name: string, projectId: string | null, onProgress?: (fraction: number) => void): Promise<{ ok: true; item: UploadRow | null } | { ok: false; error: string }> {
  // A larger picture (up to 50 MB) goes straight to storage. If the browser cannot reach storage, it is redrawn smaller and sent the old way.
  if (file.size > SMALL_LIMIT) {
    const r = await uploadDirect<UploadRow>(file, "image", { kind, name, projectId }, onProgress);
    if (r.ok) return { ok: true, item: r.item };
    if (!r.unavailable) return { ok: false, error: r.error };
    const fitted = await redrawToFit(file);
    if (!fitted) return { ok: false, error: r.error };
    file = fitted;
  }
  const form = new FormData();
  form.set("file", file); form.set("kind", kind); form.set("name", name); form.set("rights", "1"); // the caller has shown the "I have the right to use this picture" box
  if (projectId) form.set("projectId", projectId);
  try {
    const res = await fetch("/api/uploads", { method: "POST", body: form });
    if (res.ok) return { ok: true, item: (await res.json().catch(() => null)) as UploadRow | null };
    const data = await res.json().catch(() => null);
    return { ok: false, error: data?.error ?? (res.status === 413 ? "That picture is larger than 4 MB. Please use a smaller one." : "Could not upload that picture.") };
  } catch {
    return { ok: false, error: "Could not upload that picture. Check your connection." };
  }
}

export async function deleteUpload(id: string): Promise<boolean> {
  try { return (await fetch(`/api/uploads/${id}`, { method: "DELETE" })).ok; } catch { return false; }
}

// A video from the device (MP4, MOV or WebM, up to 500 MB): it becomes one of the person's own videos once it has been checked.
export async function uploadVideo<T>(file: File, name: string, projectId: string | null, onProgress?: (fraction: number) => void): Promise<{ ok: true; item: T } | { ok: false; error: string }> {
  const r = await uploadDirect<T>(file, "video", { name, projectId }, onProgress);
  return r.ok ? r : { ok: false, error: r.error };
}
