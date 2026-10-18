import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { checkFields, sendTo, SendError, verify, VERIFY_ONLY } from "@/lib/connector-send";
import { directConnectors } from "@/lib/connectors";
import { db } from "@/lib/db";
import { claimUsage } from "@/lib/usage";
import { seal } from "@/lib/secret-box";

export const maxDuration = 30;

// Connect an app: the credential is checked, a test message is sent to prove it works (task and issue apps are checked with a read instead, so
// connecting never creates a stray task), and only then is it stored (encrypted).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const u = await requireUser(); if ("fail" in u) return u.fail;
  const id = params.id;
  if (!directConnectors[id]) {
    return NextResponse.json({ error: "Connecting this app needs a sign-in approved by the service, and this server has no app registered with it yet." }, { status: 501 });
  }
  // Connecting sends a real test message (or, for task and issue apps, checks the key with a read), so it is limited: 10 tries every 10 minutes.
  if (!(await claimUsage(u.userId, "connector", 10, 10 * 60_000))) return NextResponse.json({ error: "Too many connection attempts. Wait a few minutes and try again." }, { status: 429 });
  const body = await req.json().catch(() => null);
  try {
    const values = checkFields(id, body && typeof body === "object" ? body : {});
    const where = VERIFY_ONLY.has(id) ? (await verify(id, values))! : await sendTo(id, values, "Eclipse is connected. Finished content you ask for will arrive here.");
    const data = { label: where, secret: seal(JSON.stringify(values)) };
    await db.connectorLink.upsert({ where: { userId_connector: { userId: u.userId, connector: id } }, create: { userId: u.userId, connector: id, ...data }, update: data });
    return NextResponse.json({ id, label: where });
  } catch (err) {
    if (err instanceof SendError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("connecting app failed", id, err);
    return NextResponse.json({ error: "Could not connect. Please try again." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const u = await requireUser(); if ("fail" in u) return u.fail;
  await db.connectorLink.deleteMany({ where: { userId: u.userId, connector: params.id } });
  return NextResponse.json({ ok: true });
}
