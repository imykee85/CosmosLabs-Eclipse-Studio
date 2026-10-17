import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { signedPutUrl, storageEnabled } from "@/lib/storage";
import { claimUsage } from "@/lib/usage";

export const dynamic = "force-dynamic";

// A file for a mini tool run goes from the browser straight to private storage (u/<user>/tools/in/...) through a one-time signed link; the run
// then checks the key is the person's own. 200 MB at most per file (and per run).
export async function POST(req: Request) {
  const u = requireUser();
  if ("fail" in u) return u.fail;
  if (!storageEnabled) return NextResponse.json({ error: "Storage is not set up yet." }, { status: 503 });
  const b = (await req.json().catch(() => null)) as { name?: unknown; size?: unknown } | null;
  const size = typeof b?.size === "number" ? b.size : 0;
  const name = (typeof b?.name === "string" ? b.name : "file").replace(/[^A-Za-z0-9._-]+/g, "_").slice(-100) || "file";
  if (!Number.isFinite(size) || size < 1) return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  if (size > 200 * 1048576) return NextResponse.json({ error: "That file is too large. The limit is 200 MB." }, { status: 413 });
  if (!(await claimUsage(u.userId, "tool-input", 60, 3600_000))) return NextResponse.json({ error: "You are adding files very quickly. Please try again later." }, { status: 429 });
  const key = `u/${u.userId}/tools/in/${randomUUID()}-${name}`;
  return NextResponse.json({ key, url: await signedPutUrl(key, "application/octet-stream") });
}
