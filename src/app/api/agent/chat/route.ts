import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { workspaceSession } from "@/lib/workspace";
import { gateFeature } from "@/lib/access";
import type { Prisma } from "@prisma/client";
import { prepareAgentTurn } from "@/lib/agent-turn";

// 120 s: Atlas can watch a video (the file is copied and frames are read from it) before it answers.
export const maxDuration = 120;

// The answer is produced by a job on the server: the browser starts it (`background`) and collects the result from /api/agent/runs, so leaving the page
// or closing the browser does not stop it. A plain request still gets its answer in the same response. The conversation itself is in src/lib/agent-turn.ts.
export async function POST(req: Request) {
  const gated = await gateFeature("atlas");
  if (gated) return gated;
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet, so the agent can't answer." }, { status: 503 });
  const { workspaceId: userId, personId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "The agent is not available yet. Please try again later." }, { status: 503 });

  const body = await req.json().catch(() => null);
  const prep = await prepareAgentTurn(userId, personId, body);
  if (!prep.ok) return NextResponse.json(prep.out.json, { status: prep.out.status });
  const work = prep.work;

  if (body?.background === true) {
    const run = await db.agentRun.create({ data: { userId, status: "pending" }, select: { id: true } });
    waitUntil(work().then(
      (out) => db.agentRun.update({ where: { id: run.id }, data: { status: out.status === 200 ? "done" : "failed", result: { status: out.status, body: out.json } as Prisma.InputJsonValue } }),
      () => db.agentRun.update({ where: { id: run.id }, data: { status: "failed", result: { status: 502, body: { error: "The agent couldn't answer. Please try again." } } as Prisma.InputJsonValue } }),
    ).catch((err) => console.error("agent run could not be saved", run.id, err)));
    return NextResponse.json({ runId: run.id }, { status: 202 });
  }
  const out = await work();
  return NextResponse.json(out.json, { status: out.status });
}
