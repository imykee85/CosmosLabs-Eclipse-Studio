import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { workspaceSession } from "@/lib/workspace";

async function userOr401() {
  if (!clerkEnabled) return { res: NextResponse.json({ error: "Preview mode" }, { status: 503 }) };
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return { res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { userId };
}

export async function GET() {
  const u = await userOr401();
  if (!u.userId) return u.res;
  try {
    const projects = await db.project.findMany({ where: { userId: u.userId }, orderBy: { updatedAt: "desc" } });
    // "Last edited" is the latest change of ANY kind: the project itself (rename, restore), a new render made in it, or a canvas edited in it.
    const last = new Map<string, number>();
    try {
      const [renders, canvases] = await Promise.all([
        db.generation.groupBy({ by: ["projectId"], where: { userId: u.userId, projectId: { not: null } }, _max: { createdAt: true } }),
        db.canvas.groupBy({ by: ["projectId"], where: { userId: u.userId }, _max: { updatedAt: true } }),
      ]);
      for (const r of renders) if (r.projectId && r._max.createdAt) last.set(r.projectId, Math.max(last.get(r.projectId) ?? 0, +r._max.createdAt));
      for (const c of canvases) if (c._max.updatedAt) last.set(c.projectId, Math.max(last.get(c.projectId) ?? 0, +c._max.updatedAt));
    } catch (err) {
      console.error("project activity lookup failed", err);
    }
    return NextResponse.json(projects.map(({ id, name, createdAt, updatedAt, deletedAt }) => ({
      id, name, createdAt, deletedAt,
      updatedAt: new Date(Math.max(+updatedAt, last.get(id) ?? 0)).toISOString(),
    })).sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)));
  } catch (err) {
    console.error("list projects failed", err);
    return NextResponse.json({ error: "Could not load your projects." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const u = await userOr401();
  if (!u.userId) return u.res;
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 60) return NextResponse.json({ error: "Enter a project name (up to 60 characters)." }, { status: 400 });
  try {
    const p = await db.project.create({ data: { userId: u.userId, name } });
    return NextResponse.json({ id: p.id, name: p.name, updatedAt: p.updatedAt, deletedAt: p.deletedAt });
  } catch (err) {
    console.error("create project failed", err);
    return NextResponse.json({ error: "Could not create the project." }, { status: 500 });
  }
}
