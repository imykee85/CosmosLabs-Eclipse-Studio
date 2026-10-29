import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { listGrants } from "@/lib/oauth";

export const dynamic = "force-dynamic";

// The apps (Claude and others) this person has connected through "Sign in with Eclipse", for Settings, API/MCP.
export async function GET() {
  if (!clerkEnabled) return NextResponse.json({ apps: [] });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ apps: await listGrants(userId) });
}
