"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { clerkEnabled } from "./clerk-enabled";

export type CanvasComment = { id: string; author: string; mine: boolean; nodeId: string | null; text: string; resolved: boolean; createdAt: string };

// The comments of one canvas (everyone in the workspace sees them). Refreshed now and then while the canvas is open.
export function useCanvasComments(canvasId: string) {
  const [items, setItems] = useState<CanvasComment[]>([]);
  const [error, setError] = useState("");
  const base = `/api/canvases/${canvasId}/comments`;
  const load = useCallback(async () => {
    if (!clerkEnabled) return;
    try {
      const res = await fetch(base);
      if (!res.ok) return;
      setItems(((await res.json()).items ?? []) as CanvasComment[]);
    } catch {}
  }, [base]);
  useEffect(() => {
    void load();
    const t = setInterval(() => { if (!document.hidden) void load(); }, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const add = useCallback(async (text: string, nodeId: string | null): Promise<boolean> => {
    setError("");
    try {
      const res = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, nodeId }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(typeof d.error === "string" ? d.error : "Could not add the comment."); return false; }
      setItems((cur) => [...cur, d.item as CanvasComment]);
      return true;
    } catch { setError("Could not add the comment. Check your connection."); return false; }
  }, [base]);
  const resolve = useCallback(async (id: string, resolved: boolean) => {
    setItems((cur) => cur.map((c) => (c.id === id ? { ...c, resolved } : c)));
    try { const r = await fetch(`${base}/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolved }) }); if (!r.ok) void load(); } catch { void load(); }
  }, [base, load]);
  const remove = useCallback(async (id: string) => {
    setItems((cur) => cur.filter((c) => c.id !== id));
    try { const r = await fetch(`${base}/${id}`, { method: "DELETE" }); if (!r.ok) void load(); } catch { void load(); }
  }, [base, load]);

  // Open comments per node (for the badge on each node).
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of items) if (c.nodeId && !c.resolved) m[c.nodeId] = (m[c.nodeId] ?? 0) + 1;
    return m;
  }, [items]);
  return { items, error, add, resolve, remove, counts, enabled: clerkEnabled };
}
