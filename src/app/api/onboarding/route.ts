import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { validAnswers } from "@/lib/onboarding";

export async function POST(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode" }, { status: 503 });
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const answers = validAnswers(await req.json().catch(() => null));
  if (!answers) return NextResponse.json({ error: "Invalid answers" }, { status: 400 });

  try {
    await db.onboarding.upsert({ where: { userId }, create: { userId, ...answers }, update: answers });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("onboarding save failed", err);
    return NextResponse.json({ error: "Could not save your answers. Please try again." }, { status: 500 });
  }
}
