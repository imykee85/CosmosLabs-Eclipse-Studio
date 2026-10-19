import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { db } from "@/lib/db";
import { ownTool, publicTool } from "@/lib/core-tools";
import { deleteObject, storageEnabled } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const u = await requireUser();
  if ("fail" in u) return u.fail;
  const t = await ownTool(u.userId, params.id);
  if (!t) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const runs = await db.sandboxJob.findMany({ where: { userId: u.userId, kind: "core.tool.run", input: { path: ["toolId"], equals: t.id } }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, status: true, createdAt: true } });
  return NextResponse.json({ tool: publicTool(t), runs });
}

// PATCH { action: "approve-internet" } records the owner's approval of THIS version's internet use (a new version needs a new approval);
// { action: "revoke-internet" } takes it back.
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const u = await requireUser();
  if ("fail" in u) return u.fail;
  const t = await ownTool(u.userId, params.id);
  if (!t) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const b = (await req.json().catch(() => null)) as { action?: unknown } | null;
  if (b?.action === "approve-internet" && t.network === "internet") return NextResponse.json({ tool: publicTool(await db.coreTool.update({ where: { id: t.id }, data: { approvedNet: t.version } })) });
  if (b?.action === "revoke-internet") return NextResponse.json({ tool: publicTool(await db.coreTool.update({ where: { id: t.id }, data: { approvedNet: null } })) });
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const u = await requireUser();
  if ("fail" in u) return u.fail;
  const t = await ownTool(u.userId, params.id);
  if (!t) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await db.coreTool.update({ where: { id: t.id }, data: { deletedAt: new Date() } });
  if (storageEnabled) for (const f of (Array.isArray(t.files) ? t.files : []) as { key?: string }[]) if (f.key) await deleteObject(f.key).catch(() => {});
  return NextResponse.json({ ok: true });
}
