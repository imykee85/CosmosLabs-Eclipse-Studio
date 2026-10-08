import { NextResponse } from "next/server";
import { enabledModels, toPublic } from "@/lib/models";

// The picker lists exactly these models and nothing else.
export async function GET() {
  return NextResponse.json({ models: enabledModels().map(toPublic) });
}
