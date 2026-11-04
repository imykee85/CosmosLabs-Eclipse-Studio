import { NextResponse } from "next/server";
import { driveInBackground, validPlanToken } from "@/lib/agent-plan-server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// The hand-over from one function to the next: signed with a token only the server can make, answers at once and keeps driving the plan in the background.
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!validPlanToken(id, req.headers.get("x-plan-token"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  driveInBackground(id);
  return NextResponse.json({ ok: true }, { status: 202 });
}
