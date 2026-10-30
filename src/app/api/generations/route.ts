import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { waitUntil } from "@vercel/functions";
import { finalizeGeneration, purgeFailed, toItem } from "@/lib/generation-jobs";
import { isLateWatch, rescueLateVideo, finalizeVideo } from "@/lib/video-jobs";
import { workspaceSession } from "@/lib/workspace";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;
const lastPurge = new Map<string, number>();
const FINISH_WAIT_MS = 3500; // checking on a running render asks the provider; one slow answer must not hold up the whole list (the row is shown as it is and the check carries on)

// The signed-in user's renders, newest first. With ?projectId= only that project's (the Gallery); without it all of them (the Library). Images in the Bin are left out unless ?bin=1 asks for exactly those. Each imageUrl is a fresh short-lived signed link, so fetch the list again rather than keeping the links.
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requested = Number(new URL(req.url).searchParams.get("limit"));
  const take = Number.isInteger(requested) && requested > 0 ? Math.min(requested, MAX_LIMIT) : DEFAULT_LIMIT;

  const params = new URL(req.url).searchParams;
  const projectId = params.get("projectId");
  const inBin = params.get("bin") === "1";
  // Videos the person added from their device are not generated, so they stay out of Library, Gallery and Video Studio's history.
  // `?uploaded=1`: only those (Assets); `?uploaded=all`: everything (the reference and Core pickers, which may use them).
  const uploadedParam = params.get("uploaded");
  const isUploaded = { kind: "video", params: { path: ["uploaded"], equals: true } };
  // "Not uploaded" is spelled out: a plain NOT on the JSON test is NULL for every video without the flag, and would hide all generated videos.
  const notUploaded = { OR: [{ kind: { not: "video" } }, { params: { equals: Prisma.DbNull } }, { params: { equals: Prisma.JsonNull } }, { params: { path: ["uploaded"], equals: Prisma.DbNull } }, { params: { path: ["uploaded"], not: true } }] };
  const uploadedOnly = uploadedParam === "1" ? isUploaded : uploadedParam === "all" ? {} : notUploaded;
  try {
    // Clearing failed renders is housekeeping: once a minute per person is plenty (the list is asked for every few seconds while a render runs).
    if (Date.now() - (lastPurge.get(userId) ?? 0) > 60_000) { lastPurge.set(userId, Date.now()); if (lastPurge.size > 5000) lastPurge.clear(); await purgeFailed(userId).catch((err) => console.error("clearing failed renders failed", err)); }
    const rows = await db.generation.findMany({ where: { userId, ...(projectId ? { projectId } : {}), ...uploadedOnly, deletedAt: inBin ? { not: null } : null }, orderBy: inBin ? { deletedAt: "desc" } : { createdAt: "desc" }, take });
    // Renders still running are checked on here, so coming back later (or from another device) finds them finished.
    // Videos we stopped waiting for are asked about again in the background (a late finish turns the row into the video on the next load).
    // Videos still marked running (the page was closed) are settled in the background, so they turn into the finished clip on the next load.
    const open = rows.filter((g) => g.kind === "video" && g.status === "pending").slice(0, 3);
    if (open.length) { try { waitUntil(Promise.allSettled(open.map(finalizeVideo))); } catch { /* not on Vercel */ } }
    const late = rows.filter(isLateWatch).slice(0, 3);
    if (late.length) { try { waitUntil(Promise.allSettled(late.map(rescueLateVideo))); } catch { /* not on Vercel */ } }
    // One bad row must never blank the whole list: if finishing or describing a render throws, fall back to the row as stored, and skip it only if even that fails.
    const settled = await Promise.all(rows.map(async (g) => {
      try { return await toItem(await Promise.race([finalizeGeneration(g), new Promise<typeof g>((resolve) => setTimeout(() => resolve(g), FINISH_WAIT_MS))])); } catch (err) {
        console.error("could not describe a render", g.id, err);
        try { return await toItem(g); } catch { return null; }
      }
    }));
    return NextResponse.json({ items: settled.filter((i) => i !== null) });
  } catch (err) {
    console.error("listing generations failed", err);
    return NextResponse.json({ error: "Could not load your renders. Please try again." }, { status: 500 });
  }
}
