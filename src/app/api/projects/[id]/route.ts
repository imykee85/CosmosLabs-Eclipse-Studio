import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";

type Ctx = { params: { id: string } };

function userOr401() {
  if (!clerkEnabled) return { res: NextResponse.json({ error: "Preview mode" }, { status: 503 }) };
  const { userId } = auth();
  if (!userId) return { res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { userId };
}

// Move to the bin or restore from it.
export async function PATCH(req: Request, { params }: Ctx) {
  const u = userOr401();
  if (!u.userId) return u.res;
  const body = await req.json().catch(() => null);
  if (body?.action !== "trash" && body?.action !== "restore") return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  try {
    const r = await db.project.updateMany({
      where: { id: params.id, userId: u.userId },
      data: { deletedAt: body.action === "trash" ? new Date() : null },
    });
    return r.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Project not found" }, { status: 404 });
  } catch (err) {
    console.error("update project failed", err);
    return NextResponse.json({ error: "Could not update the project." }, { status: 500 });
  }
}

// Delete forever: only allowed for projects already in the bin.
export async function DELETE(_req: Request, { params }: Ctx) {
  const u = userOr401();
  if (!u.userId) return u.res;
  try {
    const r = await db.project.deleteMany({ where: { id: params.id, userId: u.userId, deletedAt: { not: null } } });
    return r.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Project not found in the bin" }, { status: 404 });
  } catch (err) {
    console.error("delete project failed", err);
    return NextResponse.json({ error: "Could not delete the project." }, { status: 500 });
  }
}
