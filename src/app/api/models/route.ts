import { NextResponse } from "next/server";
import { enabledModels, toPublic } from "@/lib/models";

// Read at request time (not frozen at build time), so the model and price settings in Vercel apply as soon as they are in effect.
export const dynamic = "force-dynamic";

// The picker lists exactly these models and nothing else. Edit models are included; the maxReferences and requiresReference flags tell the page to ask for pictures.
export async function GET() {
  return NextResponse.json({ models: enabledModels().map(toPublic) });
}
