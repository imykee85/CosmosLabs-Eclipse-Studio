import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { db } from "@/lib/db";
import { gateFeature } from "@/lib/access";
import { connectorGroups, connectorId } from "@/lib/connectors";
import { performSend } from "@/lib/connect-tools";
import { claimUsage } from "@/lib/usage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const appName = (id: string) => connectorGroups.flatMap((g) => g.items).find((c) => connectorId(c) === id)?.name ?? id;
const EXPIRES_MS = 24 * 3600_000;

// A message the Core assistant prepared for a connected app. It is sent only here, when the person presses Send; the assistant cannot call this.
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const u = await requireUser(); if ("fail" in u) return u.fail;
  const r = await db.pendingSend.findFirst({ where: { id, userId: u.userId } });
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const link = await db.connectorLink.findUnique({ where: { userId_connector: { userId: u.userId, connector: r.app } }, select: { label: true } });
  const expired = r.status === "pending" && Date.now() - r.createdAt.getTime() > EXPIRES_MS;
  return NextResponse.json({ id: r.id, app: r.app, appName: appName(r.app), destination: link?.label ?? "", text: r.text, hasPicture: Boolean(r.generationId), status: expired ? "expired" : r.status, error: r.error });
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const gated = await gateFeature("core");
  if (gated) return gated;
  const u = await requireUser(); if ("fail" in u) return u.fail;
  if (!(await claimUsage(u.userId, "send-approve", 30, 60_000))) return NextResponse.json({ error: "Too many sends. Try again in a moment." }, { status: 429 });
  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (action !== "send" && action !== "cancel") return NextResponse.json({ error: "Send or cancel." }, { status: 400 });
  const r = await db.pendingSend.findFirst({ where: { id, userId: u.userId } });
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (r.status !== "pending") return NextResponse.json({ error: "This message was already handled.", status: r.status }, { status: 409 });
  if (Date.now() - r.createdAt.getTime() > EXPIRES_MS) return NextResponse.json({ error: "This message is too old. Ask Core to prepare it again.", status: "expired" }, { status: 410 });
  if (action === "cancel") {
    await db.pendingSend.updateMany({ where: { id, userId: u.userId, status: "pending" }, data: { status: "canceled", decidedAt: new Date() } });
    return NextResponse.json({ status: "canceled" });
  }
  // Claimed once: two taps (or two tabs) can never send twice.
  const claimed = await db.pendingSend.updateMany({ where: { id, userId: u.userId, status: "pending" }, data: { status: "sending" } });
  if (claimed.count !== 1) return NextResponse.json({ error: "This message was already handled." }, { status: 409 });
  const out = await performSend(u.userId, r.app, r.text, r.generationId);
  if (out.ok) {
    await db.pendingSend.update({ where: { id }, data: { status: "sent", decidedAt: new Date() } });
    return NextResponse.json({ status: "sent", to: out.to });
  }
  await db.pendingSend.update({ where: { id }, data: { status: "failed", error: out.error.slice(0, 300), decidedAt: new Date() } });
  return NextResponse.json({ status: "failed", error: out.error }, { status: 502 });
}
