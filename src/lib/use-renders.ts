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
  seed: number | null;
  seedLocked: boolean;
  references: { type: string; id: string }[] | null;
  status: "pending" | "completed" | "failed";
  error: string | null;
  imageUrl: string | null;
  kind: "image" | "video";
  durationSec: number | null;
  hasAudio: boolean | null;
  credits: number | null;
  startedAt: string | null;
  createdAt: string;
  deletedAt: string | null;
};

const POLL_MS = 3000;
const VIDEO_POLL_MS = 5000; // a video runs for minutes: ask the provider every few seconds, not every 3

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
    const videos = items?.filter((g) => g.status === "pending" && g.kind === "video") ?? [];
    if (videos.length) {
      // A running video is finished by its own route (the list never starts a long copy): ask it about each running video, then reload the list.
      timer.current = setTimeout(async () => {
        await Promise.all(videos.map((v) => fetch(`/api/generations/${v.id}/status`).catch(() => null)));
        if (live.current) load();
      }, VIDEO_POLL_MS);
    } else if (items?.some((g) => g.status === "pending")) timer.current = setTimeout(load, POLL_MS);
  }, [projectId, limit, bin]);

  useEffect(() => {
    live.current = true;
    load();
    return () => { live.current = false; clearTimeout(timer.current); };
  }, [load]);

  return { renders, reload: load };
}
