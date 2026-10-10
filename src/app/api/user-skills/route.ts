import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const MAX_SKILLS = 50;

export async function GET() {
  const u = requireUser(); if ("fail" in u) return u.fail;
  const rows = await db.userSkill.findMany({ where: { userId: u.userId }, orderBy: { createdAt: "desc" }, take: MAX_SKILLS });
  return NextResponse.json({ items: rows.map((s) => ({ id: s.id, name: s.name, blurb: s.blurb, instructions: s.instructions })) });
}

export async function POST(req: Request) {
  const u = requireUser(); if ("fail" in u) return u.fail;
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const blurb = typeof body?.blurb === "string" ? body.blurb.trim() : "";
  const instructions = typeof body?.instructions === "string" ? body.instructions.trim() : "";
  if (!name || name.length > 60) return NextResponse.json({ error: "Give the skill a name (up to 60 characters)." }, { status: 400 });
  if (blurb.length > 160) return NextResponse.json({ error: "Keep the description under 160 characters." }, { status: 400 });
  if (instructions.length < 10 || instructions.length > 4000) return NextResponse.json({ error: "Write the steps the assistant should follow (10 to 4000 characters)." }, { status: 400 });
  if ((await db.userSkill.count({ where: { userId: u.userId } })) >= MAX_SKILLS) return NextResponse.json({ error: "You have reached the limit of 50 skills." }, { status: 409 });
  const s = await db.userSkill.create({ data: { userId: u.userId, name, blurb, instructions } });
  return NextResponse.json({ id: s.id, name: s.name, blurb: s.blurb, instructions: s.instructions });
}
