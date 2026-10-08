"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Render = {
  id: string;
  prompt: string;
  model: string | null;
  modelLabel: string | null;
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  resolution: string | null;
  projectId: string | null;
  aspectRatio: string | null;
  status: "pending" | "completed" | "failed";
  error: string | null;
  imageUrl: string | null;
  createdAt: string;
  deletedAt: string | null;
};

const POLL_MS = 3000;

// The signed-in user's renders, newest first (one project's when projectId is given; the ones in the Bin when bin is true). While any render is still
// running the list is fetched again every few seconds, so a render finishes on screen without a refresh, and one
// started before leaving the page (or on another device) is found again when you come back.
export function useRenders(projectId?: string | null, limit = 100, bin = false) {
  const [renders, setRenders] = useState<Render[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const live = useRef(true);

  const load = useCallback(async () => {
    if (projectId === null) { setRenders([]); return; }
    const q = new URLSearchParams({ limit: String(limit) });
    if (projectId) q.set("projectId", projectId);
    if (bin) q.set("bin", "1");
    let items: Render[] | null = null;
    try {
      const r = await fetch(`/api/generations?${q}`);
      if (r.ok) items = (await r.json()).items ?? [];
    } catch {}
    if (!live.current) return;
    if (items) setRenders(items); else setRenders((cur) => cur ?? []);
    clearTimeout(timer.current);
    if (items?.some((g) => g.status === "pending")) timer.current = setTimeout(load, POLL_MS);
  }, [projectId, limit, bin]);

  useEffect(() => {
    live.current = true;
    load();
    return () => { live.current = false; clearTimeout(timer.current); };
  }, [load]);

  return { renders, reload: load };
}
