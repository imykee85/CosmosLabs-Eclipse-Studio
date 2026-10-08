import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { finalizeGeneration, toItem } from "@/lib/generation-jobs";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

// The signed-in user's renders, newest first. With ?projectId= only that project's (the Gallery); without it all of them (the Library). Images in the Bin are left out unless ?bin=1 asks for exactly those. Each imageUrl is a fresh short-lived signed link, so fetch the list again rather than keeping the links.
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requested = Number(new URL(req.url).searchParams.get("limit"));
  const take = Number.isInteger(requested) && requested > 0 ? Math.min(requested, MAX_LIMIT) : DEFAULT_LIMIT;

  const params = new URL(req.url).searchParams;
  const projectId = params.get("projectId");
  const inBin = params.get("bin") === "1";
  try {
    const rows = await db.generation.findMany({ where: { userId, ...(projectId ? { projectId } : {}), deletedAt: inBin ? { not: null } : null }, orderBy: inBin ? { deletedAt: "desc" } : { createdAt: "desc" }, take });
    // Renders still running are checked on here, so coming back later (or from another device) finds them finished.
    const items = await Promise.all(rows.map(async (g) => toItem(await finalizeGeneration(g))));
    return NextResponse.json({ items });
  } catch (err) {
    console.error("listing generations failed", err);
    return NextResponse.json({ error: "Could not load your renders. Please try again." }, { status: 500 });
  }
}
