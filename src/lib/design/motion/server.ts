// Shared route helpers for Design Studio Motion: who is asking, loading a motion with its versions, starting a version in the background.
import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { clerkEnabled } from "../../clerk-enabled";
import { gateFeature } from "../../access";
import { workspaceSession } from "../../workspace";
import { db } from "../../db";
import { advanceSound, failStale, kitItem, runVersion, toVersionItem, type RunInput } from "./agent";
import { cleanSettings, RUNNING, type MotionItem, type MotionStatus } from "./spec";

export const MAX_RUNNING = 2;

export async function motionUser(gate = true): Promise<{ userId: string; personId: string } | { res: NextResponse }> {
  if (gate) { const g = await gateFeature("studios"); if (g) return { res: g }; }
  if (!clerkEnabled) return { res: NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 }) };
  const { workspaceId, personId } = await workspaceSession();
  if (!workspaceId || !personId) return { res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { userId: workspaceId, personId };
}

export async function loadMotion(userId: string, id: string): Promise<MotionItem | null> {
  const m = await db.motion.findFirst({ where: { id, userId, deletedAt: null } });
  if (!m) return null;
  const rows = await db.motionVersion.findMany({ where: { motionId: id }, orderBy: { n: "desc" }, take: 60 });
  const versions = [];
  for (const r of rows) versions.push(toVersionItem(await advanceSound(await failStale(r), userId).catch(() => r)));
  return { id: m.id, title: m.title, prompt: m.prompt, settings: cleanSettings(m.settings), createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString(), versions };
}

export async function runningCount(userId: string): Promise<number> {
  return db.motionVersion.count({ where: { userId, status: { in: [...RUNNING].filter((s) => s !== "finishing") as MotionStatus[] } } });
}

export async function kitFor(userId: string, id: string | null) {
  if (!id) return null;
  const k = await db.brandKit.findFirst({ where: { id, userId } });
  return k ? kitItem(k) : null;
}

/** Runs a version after the answer has gone out (the browser polls the motion). */
export function runInBackground(i: RunInput) {
  waitUntil(runVersion(i).catch((e) => console.error("motion background run", e)));
}
