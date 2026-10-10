import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";

/** The signed-in user's id, or the response to return instead (preview mode / not signed in). */
export function requireUser(): { userId: string } | { fail: NextResponse } {
  if (!clerkEnabled) return { fail: NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 }) };
  const { userId } = auth();
  if (!userId) return { fail: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { userId };
}
