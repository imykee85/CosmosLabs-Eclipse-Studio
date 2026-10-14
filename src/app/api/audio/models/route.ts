import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { audioCreditsOn, creditsPerChar } from "@/lib/audio/pricing";
import { modelAvailable } from "@/lib/audio/providers";
import { ttsModels } from "@/lib/audio/registry";

export const dynamic = "force-dynamic";

// Every voice model with its limits and the controls it supports, so the page responds before any provider key is set. `ready` is false while the model's provider key
// (or sign-in) is missing; such a model can be chosen but Generate is refused with a plain message. Prices are never shown; with credits on, the credits for one character
// let the page show the cost on the Generate button (the same rounding as the server: at least 1, rounded up).
export async function GET() {
  if (clerkEnabled && !auth().userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const on = audioCreditsOn();
  return NextResponse.json({
    models: ttsModels().map((m) => ({
      id: m.id, label: m.label, maxChars: m.maxChars, supports: m.supports, note: m.note ?? null,
      ready: clerkEnabled && modelAvailable(m),
      creditsPerChar: on && m.priceUnit === "char" ? creditsPerChar(m) : null,
    })),
  });
}
