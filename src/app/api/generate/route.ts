import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { generateImage } from "@/lib/higgsfield";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  if (prompt.length > 2000) return NextResponse.json({ error: "Prompt is too long" }, { status: 400 });

  try {
    const imageUrl = await generateImage(prompt);
    const generation = await db.generation.create({ data: { userId, prompt, imageUrl } });
    return NextResponse.json(generation);
  } catch (err) {
    console.error("generation failed", err);
    return NextResponse.json({ error: "Generation failed. Please try again." }, { status: 502 });
  }
}
