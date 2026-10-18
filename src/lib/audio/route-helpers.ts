import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { workspaceSession } from "@/lib/workspace";

// Every audio route: sign-in first (401), then the owner check on the record (404, never the data of someone else).
export function audioUser(): { userId: string } | { res: NextResponse } {
  if (!clerkEnabled) return { res: NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 }) };
  const { workspaceId: userId } = workspaceSession();
  if (!userId) return { res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { userId };
}
