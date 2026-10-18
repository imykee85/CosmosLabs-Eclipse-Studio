import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { requireUser } from "@/lib/api-user";
import { ownTool, toolRunInput, ToolRunError } from "@/lib/core-tools";
import { muxEnabled, muxInputFor } from "@/lib/sandbox/kinds/mux";
import { JobInputError } from "@/lib/sandbox/kinds/types";
import { PERSON_KINDS } from "@/lib/sandbox/kinds";
import { drive, enqueue } from "@/lib/sandbox/runner";
import { jobView } from "@/lib/sandbox/view";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Starts a sandbox job for the signed-in person. The browser sends ids only (a sound take, a tool and its form values); the server checks they
// are the person's own and builds the job input itself. The job is then driven for up to 45 s in the background so a short job finishes even if
// the page closes; the page follows it with GET /api/sandbox/jobs/<id>.
export async function POST(req: Request) {
  const u = await requireUser();
  if ("fail" in u) return u.fail;
  const b = (await req.json().catch(() => null)) as { kind?: unknown; input?: unknown } | null;
  const kind = typeof b?.kind === "string" ? b.kind : "";
  if (!(PERSON_KINDS as readonly string[]).includes(kind)) return NextResponse.json({ error: "Unknown job kind." }, { status: 400 });
  const id = `sbx${randomUUID().replace(/-/g, "").slice(0, 21)}`;
  let input: unknown;
  try {
    if (kind === "media.mux") {
      if (!muxEnabled()) return NextResponse.json({ error: "Downloading the video with sound is not switched on yet." }, { status: 503 });
      input = await muxInputFor(u.userId, id, b?.input);
    } else {
      const body = (b?.input ?? {}) as { toolId?: unknown; values?: unknown; files?: unknown };
      const tool = typeof body.toolId === "string" ? await ownTool(u.userId, body.toolId) : null;
      if (!tool) return NextResponse.json({ error: "That tool was not found." }, { status: 404 });
      input = await toolRunInput(u.userId, tool, id, body);
    }
  } catch (err) {
    if (err instanceof JobInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof ToolRunError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  const q = await enqueue(kind, u.userId, input, { id });
  if (!q.ok) return NextResponse.json({ error: q.error }, { status: q.status });
  waitUntil(drive(q.job.id, 45_000).catch((e) => console.error("sandbox drive failed", q.job.id, e)));
  return NextResponse.json({ job: await jobView(q.job) }, { status: 202 });
}
