import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { quoteUpscale } from "@/lib/topaz/jobs";
import { topazConfigured } from "@/lib/topaz/models";
import { claimUsage } from "@/lib/usage";
import { workspaceSession } from "@/lib/workspace";

export const maxDuration = 30;

// What an upscale would give and cost, before anything is started. GET answers only whether Upscale is switched on.
export async function GET() {
  const available = clerkEnabled && topazConfigured();
  return NextResponse.json({ available });
}

export async function POST(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ ok: false, error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await claimUsage(userId, "upscale-quote", 60, 60_000))) return NextResponse.json({ ok: false, error: "Too many at once. Try again in a minute." }, { status: 429 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const q = await quoteUpscale(userId, body as Record<string, unknown>).catch(() => null);
  if (!q) return NextResponse.json({ ok: false, error: "Could not work out the price." }, { status: 500 });
  return NextResponse.json(q, { status: q.ok ? 200 : q.status });
}
