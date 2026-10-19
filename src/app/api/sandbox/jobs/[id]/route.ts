import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { db } from "@/lib/db";
import { advanceIfStale } from "@/lib/sandbox/runner";
import { jobView } from "@/lib/sandbox/view";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One of the person's own sandbox jobs. Asking moves it forward one step when nobody has in the last moment (that is what drives it while the
// page is open); anyone else's job is "not found".
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const u = await requireUser();
  if ("fail" in u) return u.fail;
  const job = await db.sandboxJob.findFirst({ where: { id: params.id, userId: u.userId } });
  if (!job) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ job: await jobView(await advanceIfStale(job)) });
}
