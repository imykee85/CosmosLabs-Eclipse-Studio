import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { db } from "@/lib/db";
import { endRun } from "@/lib/sandbox/runs";
import { signedMediaUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Stop a build (saves what exists first). Another person's run answers 404.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const u = requireUser(); if ("fail" in u) return u.fail;
  const run = await db.sandboxRun.findFirst({ where: { id: params.id, userId: u.userId } });
  if (!run) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await endRun(run.id, "stopped", "Stopped by you.");
  return NextResponse.json({ ok: true });
}

// A short-lived download link for the saved site.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = requireUser(); if ("fail" in u) return u.fail;
  const run = await db.sandboxRun.findFirst({ where: { id: params.id, userId: u.userId } });
  if (!run?.resultKey) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ url: await signedMediaUrl(run.resultKey, { download: "site.zip", contentType: "application/zip" }) });
}
