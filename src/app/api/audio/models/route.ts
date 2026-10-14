import { NextResponse } from "next/server";
import { audioCreditsOn, creditsPerChar } from "@/lib/audio/pricing";
import { modelAvailable } from "@/lib/audio/providers";
import { ttsModels } from "@/lib/audio/registry";
import { audioUser } from "@/lib/audio/route-helpers";

export const dynamic = "force-dynamic";

// The models that can run right now (their provider key is set), with the limits and which controls each supports. Prices are never shown; with credits on, the credits for
// one character let the page show the cost on the Generate button (the same rounding as the server: at least 1, rounded up).
export async function GET() {
  const u = audioUser();
  if ("res" in u) return u.res;
  const on = audioCreditsOn();
  return NextResponse.json({
    models: ttsModels().filter(modelAvailable).map((m) => ({
      id: m.id, label: m.label, maxChars: m.maxChars, supports: m.supports, note: m.note ?? null,
      creditsPerChar: on && m.priceUnit === "char" ? creditsPerChar(m) : null,
    })),
  });
}
