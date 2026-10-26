import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { workspaceSession } from "@/lib/workspace";

/** The signed-in person and the workspace their canvases live in, or the response to send instead. */
export async function canvasUser(): Promise<{ person: string; workspace: string } | { res: NextResponse }> {
  if (!clerkEnabled) return { res: NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 }) };
  const s = await workspaceSession();
  if (!s.personId || !s.workspaceId) return { res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { person: s.personId, workspace: s.workspaceId };
}

/** A random, unguessable link token (24 characters, URL-safe). */
export function newShareToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

export const validToken = (t: string) => /^[A-Za-z0-9_-]{20,40}$/.test(t);
