"use client";

import { useCallback, useEffect, useState } from "react";
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

export async function uploadPicture(file: File, kind: UploadKind, name: string, projectId: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const form = new FormData();
  form.set("file", file); form.set("kind", kind); form.set("name", name);
  if (projectId) form.set("projectId", projectId);
  try {
    const res = await fetch("/api/uploads", { method: "POST", body: form });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => null);
    return { ok: false, error: data?.error ?? (res.status === 413 ? "That picture is larger than 4 MB. Please use a smaller one." : "Could not upload that picture.") };
  } catch {
    return { ok: false, error: "Could not upload that picture. Check your connection." };
  }
}

export async function deleteUpload(id: string): Promise<boolean> {
  try { return (await fetch(`/api/uploads/${id}`, { method: "DELETE" })).ok; } catch { return false; }
}
