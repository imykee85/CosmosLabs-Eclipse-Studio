import { NextResponse } from "next/server";
import { ctxFor, providerFor } from "@/lib/audio/providers";
import { findAudioModel } from "@/lib/audio/registry";
import { audioUser } from "@/lib/audio/route-helpers";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { ProviderFailure, type Voice } from "@/lib/audio/types";
import { listOwnVoices } from "@/lib/audio/voices";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// The voices of one model's provider, fetched live and cached for ten minutes per server instance (never hard-code voice ids: ElevenLabs' premade voices expire 2026-12-31).
const cache = new Map<string, { at: number; voices: Voice[] }>();
const TTL_MS = 10 * 60_000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const model = findAudioModel(url.searchParams.get("model"));
  if (!model) return NextResponse.json({ error: "That voice model is not available." }, { status: 400 });
  // Not connected yet (preview mode or no provider key): an empty list the page can show calmly, never an error.
  if (!clerkEnabled) return NextResponse.json({ voices: [], ready: false });
  const u = audioUser();
  if ("res" in u) return u.res;
  const ctx = ctxFor(model);
  if (!ctx) return NextResponse.json({ voices: [], ready: false });
  const provider = providerFor(model);
  const search = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  // The person's own cloned and designed voices come first (only this person's, for this provider).
  const own = await listOwnVoices(u.userId, model.provider, search || undefined).catch((err) => { console.error("listing own voices failed", err); return [] as Voice[]; });
  if (!provider.listVoices) return NextResponse.json({ voices: own, ready: true });
  const key = `${model.provider}:${search.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json({ voices: [...own, ...hit.voices], ready: true });
  try {
    const voices = await provider.listVoices(ctx, { search: search || undefined });
    cache.set(key, { at: Date.now(), voices });
    if (cache.size > 50) cache.delete(cache.keys().next().value as string);
    return NextResponse.json({ voices: [...own, ...voices], ready: true });
  } catch (err) {
    if (err instanceof ProviderFailure) {
      if (err.error.alert) console.error("AUDIO ALERT: listing voices", model.provider, err.error.code);
      return NextResponse.json({ error: err.error.userMessage }, { status: err.error.retryable ? 503 : 502 });
    }
    console.error("listing voices failed", err);
    return NextResponse.json({ error: "Could not load the voices." }, { status: 502 });
  }
}
