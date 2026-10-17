import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { cancel } from "@/lib/sandbox/runner";
import { jobView } from "@/lib/sandbox/view";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The person's own Cancel: stops the command and the cloud computer; nothing is charged.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const u = requireUser();
  if ("fail" in u) return u.fail;
  const job = await cancel(params.id, u.userId);
  if (!job) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ job: await jobView(job) });
}
