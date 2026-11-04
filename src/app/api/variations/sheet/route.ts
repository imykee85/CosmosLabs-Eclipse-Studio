import { NextResponse } from "next/server";
import { gateFeature } from "@/lib/access";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { getObjectBytes, saveImageBytes, storageEnabled } from "@/lib/storage";
import { claimUsage } from "@/lib/usage";
import { composeSheet } from "@/lib/variations/sheet";
import { GRIDS, gridCount, type GridId } from "@/lib/variations/prompt";
import { workspaceSession } from "@/lib/workspace";

export const maxDuration = 60;

// One contact sheet from finished variations: the cells are the person's own finished pictures (owner-checked by id), laid out in the order given.
// Saved as one more picture (marked as made by AI) and the cells are tagged with the set. The same cells always give the same sheet (a second ask returns the first).
export async function POST(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const gated = await gateFeature("studios");
  if (gated) return gated;
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const grid = (GRIDS as readonly string[]).includes(body?.grid) ? (body.grid as GridId) : null;
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length < 64) : [];
  if (!grid || ids.length < 2 || ids.length > gridCount(grid) || new Set(ids).size !== ids.length) return NextResponse.json({ error: "Choose at least two finished variations." }, { status: 400 });
  if (!storageEnabled) return NextResponse.json({ error: "The sheet needs file storage, which is not set up yet." }, { status: 503 });
  if (!(await claimUsage(userId, "variations-sheet", 20, 60_000))) return NextResponse.json({ error: "Too many at once. Try again in a minute." }, { status: 429 });
  try {
    const key = ids.join(",");
    const same = await db.generation.findFirst({ where: { userId, deletedAt: null, params: { path: ["variationSet", "key"], equals: key } }, select: { id: true } });
    if (same) return NextResponse.json({ id: same.id });
    const rows = await db.generation.findMany({ where: { id: { in: ids }, userId, status: "completed", deletedAt: null, kind: "image", storageKey: { not: null } }, select: { id: true, storageKey: true, projectId: true, params: true } });
    if (rows.length !== ids.length) return NextResponse.json({ error: "Some of those pictures are not finished yet." }, { status: 409 });
    const ordered = ids.map((id) => rows.find((r) => r.id === id)!);
    const [a, b] = grid.split("x").map(Number); // "2x3" is 2 rows of 3
    const images = await Promise.all(ordered.map((r) => getObjectBytes(r.storageKey as string, 40 * 1024 * 1024)));
    const sheet = await composeSheet({ images, cols: b, rows: a });
    const saved = await saveImageBytes(userId, sheet.bytes, "image/jpeg");
    const mode = typeof body?.mode === "string" ? body.mode.slice(0, 20) : "variations";
    const refId = typeof body?.referenceId === "string" && body.referenceId.length < 64 ? body.referenceId : null;
    const created = await db.generation.create({
      data: { userId, prompt: `Variations sheet (${mode}, ${grid})`, imageUrl: "", status: "completed", storageKey: saved.key, contentType: saved.contentType, sizeBytes: saved.sizeBytes, width: saved.width, height: saved.height, projectId: ordered[0].projectId, model: "variations", kind: "image", params: { variationSet: { key, grid, mode, cells: ids, cellW: sheet.cellW, cellH: sheet.cellH, ...(refId ? { referenceId: refId } : {}) }, aiGenerated: true } },
    });
    await Promise.all(ordered.map((r, i) => db.generation.update({ where: { id: r.id }, data: { params: { ...(r.params && typeof r.params === "object" && !Array.isArray(r.params) ? (r.params as object) : {}), variationOf: created.id, variationIndex: i, aiGenerated: true } } })));
    return NextResponse.json({ id: created.id });
  } catch (err) {
    console.error("variations sheet failed", err);
    return NextResponse.json({ error: "The sheet could not be made. The separate pictures are still saved." }, { status: 500 });
  }
}
