import { NextResponse } from "next/server";
import { deleteThumb } from "@/lib/thumbs";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { deleteObject, storageEnabled } from "@/lib/storage";
import { workspaceSession } from "@/lib/workspace";

// Delete an upload for good: the stored file first, then the record.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const row = await db.upload.findFirst({ where: { id: params.id, userId } });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (storageEnabled) {
      await deleteThumb(row.storageKey);
      try { await deleteObject(row.storageKey); } catch (err) { console.error("deleting the uploaded file failed", row.id, err); return NextResponse.json({ error: "Could not remove the stored file. Please try again." }, { status: 502 }); }
    }
    await db.upload.deleteMany({ where: { id: row.id, userId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("deleting upload failed", err);
    return NextResponse.json({ error: "Could not delete the picture." }, { status: 500 });
  }
}

// Rename.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().replace(/\s+/g, " ").slice(0, 80) : "";
  if (!name) return NextResponse.json({ error: "Give it a name." }, { status: 400 });
  const r = await db.upload.updateMany({ where: { id: params.id, userId }, data: { name } });
  return r.count ? NextResponse.json({ ok: true, name }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
