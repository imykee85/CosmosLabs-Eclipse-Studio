import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { finalizeGeneration, toItem } from "@/lib/generation-jobs";

export const maxDuration = 60;

// One render of the signed-in user. If it is still running this checks on it (and stores it when done); a finished
// one comes back with a fresh short-lived image link.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const row = await db.generation.findFirst({ where: { id: params.id, userId } });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(await toItem(await finalizeGeneration(row)));
  } catch (err) {
    console.error("loading generation failed", err);
    return NextResponse.json({ error: "Could not load this render." }, { status: 500 });
  }
}
