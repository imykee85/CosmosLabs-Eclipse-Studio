"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type Model3DInfo = { id: string; label: string; maker: string; modes: ("image" | "multi" | "text")[]; minImages: number; maxImages: number; blurb: string; polyMin: number; polyMax: number; polyDefault: number; credits: number | null };
export type Item3D = { id: string; model: string; modelLabel: string; mode: string; name: string; prompt: string; status: string; error: string | null; sizeBytes: number | null; createdAt: string; fileUrl: string | null };

export function use3D() {
  const [items, setItems] = useState<Item3D[] | null>(null);
  const [models, setModels] = useState<Model3DInfo[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/design/3d?models=1", { cache: "no-store" });
      if (!r.ok) { setItems((c) => c ?? []); return; }
      const j = await r.json();
      setItems(j.items ?? []); if (j.models) setModels(j.models);
    } catch { setItems((c) => c ?? []); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const running = (items ?? []).some((i) => i.status === "pending" || i.status === "saving");
  useEffect(() => {
    if (!running) return;
    timer.current = setTimeout(() => { void load(); }, document.hidden ? 20000 : 5000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [running, items, load]);
  return { items, models, reload: load };
}

export async function start3DModel(body: { model: string; mode: string; prompt: string; refs: { type: "upload" | "render"; id: string }[]; options: { textured: boolean; pbr: boolean; polycount: number | null }; projectId?: string | null }): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  try {
    const r = await fetch("/api/design/3d", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true } : { ok: false, error: j.error ?? "Something went wrong.", code: j.code };
  } catch { return { ok: false, error: "Could not reach Eclipse. Check your connection." }; }
}
export const delete3DModel = async (id: string) => (await fetch(`/api/design/3d/${id}`, { method: "DELETE" })).ok;
export const rename3DModel = async (id: string, name: string) => (await fetch(`/api/design/3d/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) })).ok;
