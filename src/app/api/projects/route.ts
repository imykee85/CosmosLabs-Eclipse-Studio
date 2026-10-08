import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";

function userOr401() {
  if (!clerkEnabled) return { res: NextResponse.json({ error: "Preview mode" }, { status: 503 }) };
  const { userId } = auth();
  if (!userId) return { res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { userId };
}

export async function GET() {
  const u = userOr401();
  if (!u.userId) return u.res;
  try {
    const projects = await db.project.findMany({ where: { userId: u.userId }, orderBy: { updatedAt: "desc" } });
    return NextResponse.json(projects.map(({ id, name, createdAt, updatedAt, deletedAt }) => ({ id, name, createdAt, updatedAt, deletedAt })));
  } catch (err) {
    console.error("list projects failed", err);
    return NextResponse.json({ error: "Could not load your projects." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const u = userOr401();
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
