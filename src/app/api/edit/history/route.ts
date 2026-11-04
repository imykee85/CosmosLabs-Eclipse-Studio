import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { editHistory } from "@/lib/edit/keep";
import { workspaceSession } from "@/lib/workspace";

// The editing timeline of one picture (the work is in src/lib/edit/keep.ts).
export async function GET(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id || id.length > 64) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  try {
    const steps = await editHistory(userId, id);
    return steps ? NextResponse.json({ steps, current: id }) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    console.error("edit history failed", err);
    return NextResponse.json({ error: "Could not load the history." }, { status: 500 });
  }
}
