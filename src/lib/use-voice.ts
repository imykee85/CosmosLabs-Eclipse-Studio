"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// The browser side of Voice Studio's routes (src/app/api/audio). A voice is a job: POST /api/audio/generate returns a "pending" item, GET /api/audio/<id> follows it.
export type AudioItem = {
  id: string; status: "pending" | "completed" | "failed"; error: string | null; text: string; chars: number; model: string; modelLabel: string;
  voiceId: string | null; voiceName: string | null; createdAt: string; durationMs: number | null; contentType: string | null; sizeBytes: number | null; url: string | null; fileName: string;
};
export type VoiceModel = { id: string; label: string; maxChars: number; note: string | null; creditsPerChar: number | null; supports: { emotionTags: boolean; speed: boolean; pitch: boolean; voiceClone: boolean; streaming: boolean; subtitles: boolean } };
export type VoiceOption = { voiceId: string; name: string; category?: string; language?: string; gender?: string; accent?: string; age?: string; descriptive?: string; previewUrl?: string };

export function useVoiceModels(): { models: VoiceModel[] | null; error: string } {
  const [models, setModels] = useState<VoiceModel[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    fetch("/api/audio/models").then(async (r) => { const d = await r.json().catch(() => null); if (!live) return; if (r.ok && Array.isArray(d?.models)) setModels(d.models); else { setModels([]); setError(d?.error ?? "Voice models could not be loaded."); } }).catch(() => { if (live) { setModels([]); setError("Voice models could not be loaded."); } });
    return () => { live = false; };
  }, []);
  return { models, error };
}

export function useVoices(modelId: string | null): { voices: VoiceOption[] | null; error: string; search: (q: string) => void } {
  const [voices, setVoices] = useState<VoiceOption[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!modelId) return;
    let live = true;
    setVoices(null);
    fetch(`/api/audio/voices?model=${encodeURIComponent(modelId)}${q ? `&q=${encodeURIComponent(q)}` : ""}`).then(async (r) => {
      const d = await r.json().catch(() => null);
      if (!live) return;
      if (r.ok && Array.isArray(d?.voices)) { setVoices(d.voices); setError(""); } else { setVoices([]); setError(d?.error ?? "The voices could not be loaded."); }
    }).catch(() => { if (live) { setVoices([]); setError("The voices could not be loaded."); } });
    return () => { live = false; };
  }, [modelId, q]);
  return { voices, error, search: setQ };
}

// The person's recent voices, and the one being followed. While any voice is pending the list is asked again every 2 seconds.
export function useVoiceJobs() {
  const [items, setItems] = useState<AudioItem[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/audio", { cache: "no-store" });
      const d = await r.json().catch(() => null);
      if (r.ok && Array.isArray(d?.items)) setItems(d.items);
      else setItems((cur) => cur ?? []);
    } catch { setItems((cur) => cur ?? []); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const pending = items?.some((i) => i.status === "pending") ?? false;
  useEffect(() => {
    if (!pending) return;
    timer.current = setTimeout(() => void load(), 2000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [pending, items, load]);
  // Links are signed for an hour: fetch again when a tab is brought back after a while.
  useEffect(() => {
    const again = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", again);
    return () => document.removeEventListener("visibilitychange", again);
  }, [load]);
  return { items, reload: load };
}

export async function startVoice(body: { text: string; model: string; voiceId: string; voiceName?: string; speed?: number; projectId?: string | null }): Promise<{ ok: true; item: AudioItem } | { ok: false; error: string }> {
  try {
    const r = await fetch("/api/audio/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, error: typeof d?.error === "string" ? d.error : "The voice could not be started. Please try again." };
    return { ok: true, item: d as AudioItem };
  } catch { return { ok: false, error: "The voice could not be started. Check your connection and try again." }; }
}

export async function deleteVoice(id: string): Promise<boolean> {
  try { return (await fetch(`/api/audio/${id}`, { method: "DELETE" })).ok; } catch { return false; }
}
