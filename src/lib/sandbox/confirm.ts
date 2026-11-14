import { waitUntil } from "@vercel/functions";
import type { PendingSend } from "@prisma/client";
import { db } from "@/lib/db";
import { fmtCredits } from "@/lib/credit-units";
import { drive, enqueue } from "@/lib/sandbox/runner";
import { kindDef } from "@/lib/sandbox/kinds";

// Paid cloud-computer jobs the Core assistant wants to start (a video edit, a kinetic film, a build session) never start by themselves:
// the assistant only QUEUES them here, the chat shows a card with the price and a Start button, and the job begins when the person presses it
// (`/api/connect/sends/<id>`), the same way a message to a connected app waits for Send.

export const JOB_PREFIX = "job:";
export const isJobApp = (app: string) => app.startsWith(JOB_PREFIX);

/** Queues a job for approval. Returns the card id and what to tell the assistant. */
export async function queueJob(o: { userId: string; chatId: string | null; kind: string; input: unknown; id: string; summary: string; onSend?: (id: string) => void }): Promise<{ text: string; isError?: boolean }> {
  const def = kindDef(o.kind);
  if (!def) return { text: "That job type is not available.", isError: true };
  const parsed = def.schema.safeParse(o.input);
  if (!parsed.success) return { text: "That request is not valid.", isError: true };
  const open = await db.pendingSend.count({ where: { userId: o.userId, status: "pending" } });
  if (open >= 20) return { text: "There are already 20 items waiting for the person to approve. Tell them to start or cancel some first.", isError: true };
  const price = def.price(parsed.data as never);
  const cost = price > 0 ? `Costs ${fmtCredits(price)} credits` : "No credits";
  const row = await db.pendingSend.create({ data: { userId: o.userId, chatId: o.chatId, app: `${JOB_PREFIX}${o.kind}`, text: `${o.summary.slice(0, 600)}\n${cost}.`, jobKind: o.kind, jobInput: { id: o.id, input: parsed.data } as never } });
  o.onSend?.(row.id);
  return { text: JSON.stringify({ queued: true, pending_id: row.id, started: false, note: "NOT STARTED YET. The person sees a card with the price and a Start button. Tell them what you prepared and that they need to press Start. Do not say it has started, and do not call this tool again for the same job." }) };
}

/** Starts an approved job for real. Only called from the person's own Start button. */
export async function startQueuedJob(row: PendingSend): Promise<{ ok: true } | { ok: false; error: string }> {
  const data = row.jobInput as { id?: string; input?: unknown } | null;
  if (!row.jobKind || !data?.id) return { ok: false, error: "This job can no longer be started." };
  const q = await enqueue(row.jobKind, row.userId, data.input, { id: data.id });
  if (!q.ok) return { ok: false, error: q.error };
  waitUntil(drive(q.job.id, 45_000).catch((e) => console.error("sandbox drive failed", q.job.id, e)));
  return { ok: true };
}
