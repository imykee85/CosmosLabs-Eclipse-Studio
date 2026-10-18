import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { saveAutoTopup } from "@/lib/billing";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { claimUsage } from "@/lib/usage";

// Saves the auto top-up choice (switch, pack, "when credits drop below", monthly limit). Anything outside the offered options is refused.
export async function PUT(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await claimUsage(userId, "auto-topup-settings", 60, 3600_000))) return NextResponse.json({ error: "Too many changes. Try again in a little while." }, { status: 429 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const r = await saveAutoTopup(userId, body as Record<string, unknown>);
  return r.ok ? NextResponse.json({ auto: r.view }) : NextResponse.json({ error: r.error }, { status: 400 });
}
