import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { deleteAccount } from "@/lib/account-delete";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { claimUsage } from "@/lib/usage";

export const maxDuration = 120;

// Deletes the signed-in person's account and everything in it, for good. The person has to type DELETE; the browser clears its own copy afterwards.
export async function POST(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (body?.confirm !== "DELETE") return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
  if (!(await claimUsage(userId, "account-delete", 5, 3600_000))) return NextResponse.json({ error: "Too many attempts. Try again in an hour." }, { status: 429 });
  const r = await deleteAccount(userId);
  return r.ok ? NextResponse.json({ ok: true, notes: r.notes }) : NextResponse.json({ error: r.error }, { status: r.status });
}
