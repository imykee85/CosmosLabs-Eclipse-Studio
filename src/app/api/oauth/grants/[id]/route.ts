import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { revokeGrant } from "@/lib/oauth";

export const dynamic = "force-dynamic";

// Disconnects one app: its access stops at once and it cannot refresh.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!clerkEnabled) return NextResponse.json({ error: "Not available." }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!/^[\w-]{1,64}$/.test(id) || !(await revokeGrant(userId, id))) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
