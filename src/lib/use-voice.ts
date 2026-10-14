"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// The browser side of Voice Studio's routes (src/app/api/audio). A voice is a job: POST /api/audio/generate returns a "pending" item, GET /api/audio/<id> follows it.
export type AudioItem = {
  id: string; status: "pending" | "completed" | "failed"; error: string | null; text: string; chars: number; model: string; modelLabel: string;
  voiceId: string | null; voiceName: string | null; createdAt: string; durationMs: number | null; contentType: string | null; sizeBytes: number | null; url: string | null; fileName: string;
};
export type VoicePricing = { unit: "char" | "byte"; perUnit: number } | { unit: "max"; credits: number } | null;
export type VoiceModel = { id: string; label: string; provider: string; providerLabel: string; ready: boolean; canClone: boolean; canDesign: boolean; maxChars: number; note: string | null; tags: string[]; voiceOptional: boolean; pricing: VoicePricing; supports: { emotionTags: boolean; speed: boolean; pitch: boolean; voiceClone: boolean; streaming: boolean; subtitles: boolean } };
export type VoiceOption = { voiceId: string; name: string; category?: string; language?: string; gender?: string; accent?: string; age?: string; descriptive?: string; previewUrl?: string; own?: boolean; ownId?: string; kind?: "cloned" | "designed" };
export type VoiceCosts = { clone: number | null; design: number | null };

export function useVoiceModels(): { models: VoiceModel[] | null; error: string; costs: VoiceCosts; consentText: string } {
  const [models, setModels] = useState<VoiceModel[] | null>(null);
  const [costs, setCosts] = useState<VoiceCosts>({ clone: null, design: null });
  const [consentText, setConsentText] = useState("I own this voice or have written permission to clone it.");
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    fetch("/api/audio/models").then(async (r) => { const d = await r.json().catch(() => null); if (!live) return; if (r.ok && Array.isArray(d?.models)) { setModels(d.models); if (d.voiceCosts) setCosts(d.voiceCosts); if (typeof d.consentText === "string") setConsentText(d.consentText); } else { setModels([]); setError(d?.error ?? "Voice models could not be loaded."); } }).catch(() => { if (live) { setModels([]); setError("Voice models could not be loaded."); } });
    return () => { live = false; };
  }, []);
  return { models, error, costs, consentText };
}

export function useVoices(modelId: string | null): { voices: VoiceOption[] | null; error: string; ready: boolean; search: (q: string) => void; reload: () => void } {
  const [tick, setTick] = useState(0);
  const [voices, setVoices] = useState<VoiceOption[] | null>(null);
  const [ready, setReady] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!modelId) return;
    let live = true;
    setVoices(null);
    fetch(`/api/audio/voices?model=${encodeURIComponent(modelId)}${q ? `&q=${encodeURIComponent(q)}` : ""}`).then(async (r) => {
      const d = await r.json().catch(() => null);
      if (!live) return;
      if (r.ok && Array.isArray(d?.voices)) { setVoices(d.voices); setReady(d.ready !== false); setError(""); } else { setVoices([]); setError(d?.error ?? "The voices could not be loaded."); }
    }).catch(() => { if (live) { setVoices([]); setError("The voices could not be loaded."); } });
    return () => { live = false; };
  }, [modelId, q, tick]);
  return { voices, error, ready, search: setQ, reload: () => setTick((t) => t + 1) };
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

// Making your own voices (clone from a sample, or design from a description) and deleting them.
export type OwnVoice = { voiceId: string; ownId: string; name: string; kind: "cloned" | "designed"; provider: string; descriptive: string };
export type DesignPreview = { token: string; sig: string; url: string; durationMs: number | null };
type Res<T> = ({ ok: true } & T) | { ok: false; error: string };
async function post<T>(url: string, body: BodyInit, json: boolean, fallback: string): Promise<Res<T>> {
  try {
    const r = await fetch(url, { method: "POST", ...(json ? { headers: { "Content-Type": "application/json" } } : {}), body });
    const d = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, error: typeof d?.error === "string" ? d.error : fallback };
    return { ok: true, ...d } as Res<T>;
  } catch { return { ok: false, error: "Check your connection and try again." }; }
}
export const cloneVoiceRequest = (fd: FormData) => post<{ voice: OwnVoice }>("/api/audio/voices/clone", fd, false, "The voice could not be created. Please try again.");
export const designVoiceRequest = (provider: string, description: string) => post<{ previews: DesignPreview[] }>("/api/audio/voices/design", JSON.stringify({ provider, description }), true, "The voice could not be designed. Please try again.");
export const saveDesignRequest = (b: { provider: string; token: string; sig: string; name: string; description: string }) => post<{ voice: OwnVoice }>("/api/audio/voices/design/save", JSON.stringify(b), true, "The voice could not be saved. Please try again.");
export async function deleteOwnVoice(ownId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const r = await fetch(`/api/audio/voices/mine/${encodeURIComponent(ownId)}`, { method: "DELETE" });
    if (r.ok) return { ok: true };
    const d = await r.json().catch(() => null);
    return { ok: false, error: typeof d?.error === "string" ? d.error : "That voice could not be deleted. Please try again." };
  } catch { return { ok: false, error: "Check your connection and try again." }; }
}
