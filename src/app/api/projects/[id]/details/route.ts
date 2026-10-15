import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";

// The facts about one project: dates, how many images it holds and how much space they and the canvas take.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode" }, { status: 503 });
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const p = await db.project.findFirst({ where: { id: params.id, userId } });
    if (!p) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const done = { userId, projectId: p.id, status: "completed" };
    const [live, binned, unmeasured, canvas] = await Promise.all([
      db.generation.aggregate({ where: { ...done, deletedAt: null }, _count: true, _sum: { sizeBytes: true } }),
      db.generation.aggregate({ where: { ...done, deletedAt: { not: null } }, _count: true, _sum: { sizeBytes: true } }),
      db.generation.count({ where: { ...done, sizeBytes: null } }),
      db.canvasState.findUnique({ where: { userId_projectId: { userId, projectId: p.id } } }),
    ]);
    const canvasData = canvas?.data as { nodes?: unknown[] } | null | undefined;
    const canvasBytes = canvas ? JSON.stringify(canvas.data).length : 0;
    const imageBytes = live._sum.sizeBytes ?? 0;
    return NextResponse.json({
      id: p.id, name: p.name, createdAt: p.createdAt, updatedAt: p.updatedAt, deletedAt: p.deletedAt,
      images: { count: live._count, bytes: imageBytes },
      binned: { count: binned._count, bytes: binned._sum.sizeBytes ?? 0 },
      unmeasured,
      canvas: canvas ? { nodes: Array.isArray(canvasData?.nodes) ? canvasData!.nodes!.length : 0, bytes: canvasBytes, updatedAt: canvas.updatedAt } : null,
      totalBytes: imageBytes + canvasBytes,
    });
  } catch (err) {
    console.error("project details failed", err);
    return NextResponse.json({ error: "Could not load the project details." }, { status: 500 });
  }
}
