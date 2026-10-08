import { NextResponse } from "next/server";
import { enabledModels, toPublic } from "@/lib/models";

// Read at request time (not frozen at build time), so the model and price settings in Vercel apply as soon as they are in effect.
export const dynamic = "force-dynamic";

// The picker lists exactly these models and nothing else (models that need an input image stay out until the app can send one).
export async function GET() {
  return NextResponse.json({ models: enabledModels().filter((m) => !m.requiresReference).map(toPublic) });
}
