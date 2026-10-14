import { NextResponse } from "next/server";
import { ctxFor, providerFor } from "@/lib/audio/providers";
import { findAudioModel } from "@/lib/audio/registry";
import { audioUser } from "@/lib/audio/route-helpers";
import { ProviderFailure, type Voice } from "@/lib/audio/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// The voices of one model's provider, fetched live and cached for ten minutes per server instance (never hard-code voice ids: ElevenLabs' premade voices expire 2026-12-31).
const cache = new Map<string, { at: number; voices: Voice[] }>();
const TTL_MS = 10 * 60_000;

export async function GET(req: Request) {
  const u = audioUser();
  if ("res" in u) return u.res;
  const url = new URL(req.url);
  const model = findAudioModel(url.searchParams.get("model"));
  const ctx = model ? ctxFor(model) : null;
  if (!model || !ctx) return NextResponse.json({ error: "That voice model is not available." }, { status: 400 });
  const provider = providerFor(model);
  if (!provider.listVoices) return NextResponse.json({ voices: [] });
  const search = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const key = `${model.provider}:${search.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json({ voices: hit.voices });
  try {
    const voices = await provider.listVoices(ctx, { search: search || undefined });
    cache.set(key, { at: Date.now(), voices });
    if (cache.size > 50) cache.delete(cache.keys().next().value as string);
    return NextResponse.json({ voices });
  } catch (err) {
    if (err instanceof ProviderFailure) {
      if (err.error.alert) console.error("AUDIO ALERT: listing voices", model.provider, err.error.code);
      return NextResponse.json({ error: err.error.userMessage }, { status: err.error.retryable ? 503 : 502 });
    }
    console.error("listing voices failed", err);
    return NextResponse.json({ error: "Could not load the voices." }, { status: 502 });
  }
}
