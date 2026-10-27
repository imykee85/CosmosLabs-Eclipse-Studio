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
  draft?: boolean;      // a Seedance 2.5 draft preview
  finalMade?: boolean;  // the final 1080p video was already started from this draft
  durationSec: number | null;
  hasAudio: boolean | null;
  uploaded?: boolean;
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
export function useRenders(projectId?: string | null, limit = 100, bin = false, uploaded = false) {
  const [renders, setRenders] = useState<Render[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const live = useRef(true);
  const tries = useRef(0);
  const loadedAt = useRef(0);

  const load = useCallback(async () => {
    if (projectId === null) { setRenders([]); return; }
    const q = new URLSearchParams({ limit: String(limit) });
    if (projectId) q.set("projectId", projectId);
    if (bin) q.set("bin", "1");
    if (uploaded) q.set("uploaded", "all");
    let items: Render[] | null = null;
    try {
      const r = await fetch(`/api/generations?${q}`);
      if (r.ok) items = (await r.json()).items ?? [];
    } catch {}
    if (!live.current) return;
    clearTimeout(timer.current);
    if (!items) {
      // A failed load is not an empty library: keep what is on screen, and keep trying (a few times at first, then every half minute) instead of settling on nothing.
      tries.current += 1;
      setRenders((cur) => (cur ?? (tries.current > 5 ? [] : null)));
      timer.current = setTimeout(load, tries.current <= 5 ? 2000 * tries.current : 30_000);
      return;
    }
    tries.current = 0;
    loadedAt.current = Date.now();
    setRenders(items);
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
    // Picture links are signed and stop working after 10 minutes: fetch the list again before they do, and when the tab comes back after a while, so tiles never go blank.
    const refresh = () => { if (Date.now() - loadedAt.current > 4 * 60_000) load(); };
    const every = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => { live.current = false; clearTimeout(timer.current); clearInterval(every); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onVisible); };
  }, [load]);

  return { renders, reload: load };
}
