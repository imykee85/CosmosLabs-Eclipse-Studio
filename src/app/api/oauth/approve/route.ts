import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { gateFeatureFor } from "@/lib/access";
import { checkAuthRequest, issueCode, redirectBack } from "@/lib/oauth";
import { claimUsage } from "@/lib/usage";

export const dynamic = "force-dynamic";

// The person's answer from the connection page. The request must come from our own page (same origin, JSON), must carry a signed-in session, and the app, its return address
// and the PKCE challenge are checked again here: nothing the page sent is trusted. Returns the address to send the person to (with the code, or access_denied).
export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  const from = req.headers.get("origin");
  if (from !== origin || !(req.headers.get("content-type") ?? "").includes("application/json")) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  if (!clerkEnabled) return NextResponse.json({ error: "Sign-in is not set up here." }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const p: Record<string, string> = {};
  for (const [k, v] of Object.entries(b ?? {})) if (typeof v === "string") p[k] = v;
  const check = await checkAuthRequest(p, origin);
  if (!check.ok) return NextResponse.json({ error: check.kind === "page" ? check.message : check.description }, { status: 400 });
  if (p.decision === "deny") return NextResponse.json({ redirect: redirectBack(check.req.redirectUri, { error: "access_denied", error_description: "The person chose not to connect." }, check.req.state) });
  if (p.decision !== "allow") return NextResponse.json({ error: "Choose Allow or Cancel." }, { status: 400 });
  const gate = await gateFeatureFor(userId, "api");
  if (!gate.ok) return NextResponse.json({ error: gate.body.error }, { status: gate.status });
  if (!(await claimUsage(userId, "oauth-approve", 20, 3600_000))) return NextResponse.json({ error: "Too many connection attempts. Try again in a while." }, { status: 429 });
  const code = await issueCode(userId, check.req);
  return NextResponse.json({ redirect: redirectBack(check.req.redirectUri, { code }, check.req.state) });
}
