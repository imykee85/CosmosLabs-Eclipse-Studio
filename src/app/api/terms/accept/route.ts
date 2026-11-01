import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { clientIp } from "@/lib/oauth-http";
import { hasAcceptedTerms, recordAcceptance } from "@/lib/terms-db";
import { TERMS_VERSION } from "@/lib/terms";

export const dynamic = "force-dynamic";

export async function GET() {
  const who = await requireUser();
  if ("fail" in who) return who.fail;
  return NextResponse.json({ version: TERMS_VERSION, accepted: await hasAcceptedTerms(who.userId) });
}

// Body: { accepted: true, version, source }. Only an explicit true for the CURRENT version is recorded.
export async function POST(req: Request) {
  const who = await requireUser();
  if ("fail" in who) return who.fail;
  const body = (await req.json().catch(() => ({}))) as { accepted?: unknown; version?: unknown; source?: unknown };
  if (body.accepted !== true || body.version !== TERMS_VERSION) {
    return NextResponse.json({ error: "Please accept the current Terms of Use and Privacy Policy." }, { status: 400 });
  }
  const source = body.source === "sign-up" ? "sign-up" : "gate";
  const ip = clientIp(req);
  await recordAcceptance(who.userId, { ip: ip === "unknown" ? null : ip, userAgent: req.headers.get("user-agent"), source });
  return NextResponse.json({ ok: true, version: TERMS_VERSION });
}
