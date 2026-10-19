import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { db } from "@/lib/db";
import { ownerItem } from "@/lib/certificates";

// Choose what the public certificate page shows besides the facts: the prompt, and the picture, video or sound itself. Both are off until the owner turns them on.
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const u = await requireUser();
  if ("fail" in u) return u.fail;
  const body = (await req.json().catch(() => null)) as { showPrompt?: unknown; showMedia?: unknown } | null;
  const data: { showPrompt?: boolean; showMedia?: boolean } = {};
  if (typeof body?.showPrompt === "boolean") data.showPrompt = body.showPrompt;
  if (typeof body?.showMedia === "boolean") data.showMedia = body.showMedia;
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  const r = await db.certificate.updateMany({ where: { id: params.id, userId: u.userId }, data });
  if (!r.count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const c = await db.certificate.findUnique({ where: { id: params.id } });
  return NextResponse.json({ certificate: c ? ownerItem(c) : null });
}

// Withdraws the certificate: its public page stops working.
export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const u = await requireUser();
  if ("fail" in u) return u.fail;
  const r = await db.certificate.deleteMany({ where: { id: params.id, userId: u.userId } });
  if (!r.count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
