import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { db } from "@/lib/db";
import { issueCertificate, ownerItem } from "@/lib/certificates";

export const maxDuration = 300; // fingerprinting a large video reads the whole file

// The signed-in person's certificates, newest first.
export async function GET() {
  const u = await requireUser();
  if ("fail" in u) return u.fail;
  const rows = await db.certificate.findMany({ where: { userId: u.userId }, orderBy: { issuedAt: "desc" }, take: 200 });
  return NextResponse.json({ certificates: rows.map(ownerItem) });
}

// Issues the certificate for one finished creation of the person's own (or returns the one already issued).
export async function POST(req: Request) {
  const u = await requireUser();
  if ("fail" in u) return u.fail;
  const body = (await req.json().catch(() => null)) as { source?: unknown; id?: unknown } | null;
  const source = body?.source === "audio" ? "audio" : body?.source === "render" ? "render" : null;
  const id = typeof body?.id === "string" && body.id.length > 0 && body.id.length <= 64 ? body.id : null;
  if (!source || !id) return NextResponse.json({ error: "Choose a finished creation to certify." }, { status: 400 });
  try {
    const r = await issueCertificate(u.userId, source, id);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ certificate: ownerItem(r.certificate), created: r.created }, { status: r.created ? 201 : 200 });
  } catch (e) {
    console.error("issuing certificate failed", e);
    return NextResponse.json({ error: "Could not issue the certificate." }, { status: 500 });
  }
}
