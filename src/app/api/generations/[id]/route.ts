import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { finalizeGeneration, toItem } from "@/lib/generation-jobs";
import { deleteObject, storageEnabled } from "@/lib/storage";

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

function authed() {
  if (!clerkEnabled) return { res: NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 }) };
  const { userId } = auth();
  if (!userId) return { res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { userId };
}

// Move an image to the Bin, or put it back. A render that is still running cannot be binned.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const u = authed();
  if (!u.userId) return u.res;
  const body = await req.json().catch(() => null);
  if (body?.action !== "trash" && body?.action !== "restore") return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  try {
    const r = await db.generation.updateMany({
      where: body.action === "trash" ? { id: params.id, userId: u.userId, deletedAt: null, status: { in: ["completed", "failed"] } } : { id: params.id, userId: u.userId, deletedAt: { not: null } },
      data: { deletedAt: body.action === "trash" ? new Date() : null },
    });
    return r.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Image not found" }, { status: 404 });
  } catch (err) {
    console.error("updating generation failed", err);
    return NextResponse.json({ error: "Could not update the image." }, { status: 500 });
  }
}

// Delete forever: only for an image already in the Bin. Removes the stored file as well as the record.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const u = authed();
  if (!u.userId) return u.res;
  try {
    const g = await db.generation.findFirst({ where: { id: params.id, userId: u.userId, deletedAt: { not: null } } });
    if (!g) return NextResponse.json({ error: "Image not found in the bin" }, { status: 404 });
    if (g.storageKey && storageEnabled) {
      try { await deleteObject(g.storageKey); } catch (err) { console.error("deleting the stored file failed", g.id, err); return NextResponse.json({ error: "Could not remove the stored file. Please try again." }, { status: 502 }); }
    }
    await db.generation.deleteMany({ where: { id: g.id, userId: u.userId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("deleting generation failed", err);
    return NextResponse.json({ error: "Could not delete the image." }, { status: 500 });
  }
}
