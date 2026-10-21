import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { audioCreditsOn, pagePricing } from "@/lib/audio/pricing";
import { modelAvailable } from "@/lib/audio/providers";
import { HIDDEN_PROVIDERS, PROVIDER_LABEL, audioModels, kindOf, musicMaxSeconds } from "@/lib/audio/registry";
import { CLONE_PROVIDERS, CONSENT_TEXT, DESIGN_PROVIDERS, voiceCredits } from "@/lib/audio/voices";

export const dynamic = "force-dynamic";

// Every voice model with its limits and the controls it supports, so the page responds before any provider key is set. `ready` is false while the model's provider key
// (or sign-in) is missing; such a model can be chosen but Generate is refused with a plain message. Prices are never shown; with credits on, the credits for one character
// let the page show the cost on the Generate button (the same rounding as the server: at least 1, rounded up).
export async function GET() {
  if (clerkEnabled && !(await auth()).userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const on = audioCreditsOn();
  return NextResponse.json({
    models: audioModels().filter((m) => !HIDDEN_PROVIDERS.includes(m.provider)).map((m) => ({
      kind: kindOf(m), kinds: m.kinds,
      options: { maxVariants: m.maxVariants ?? null, negativePrompt: !!m.negativePrompt, videoInput: !!m.videoInput, durationRequired: !!m.durationRequired, formats: m.formats ?? null, diarize: !!m.diarize, loop: !!m.loop, instrumental: !!m.instrumental, minSeconds: m.minSeconds ?? null, maxSeconds: m.kinds.includes("music") ? musicMaxSeconds(m) : m.maxSeconds ?? null, maxInputBytes: m.maxInputBytes ?? null, maxInputSeconds: m.maxInputSeconds ?? null, long: !!m.asyncAbove },
      id: m.id, label: m.label, provider: m.provider, providerLabel: PROVIDER_LABEL[m.provider], maxChars: m.maxChars, supports: m.supports, note: m.note ?? null,
      tags: m.supports.emotionTags ? m.tags ?? [] : [], voiceOptional: !!m.voiceOptional,
      ready: clerkEnabled && modelAvailable(m),
      pricing: on ? pagePricing(m) : null,
      canClone: CLONE_PROVIDERS.includes(m.provider), canDesign: DESIGN_PROVIDERS.includes(m.provider),
    })),
    voiceCosts: { clone: voiceCredits("clone"), design: voiceCredits("design") }, consentText: CONSENT_TEXT,
  });
}
