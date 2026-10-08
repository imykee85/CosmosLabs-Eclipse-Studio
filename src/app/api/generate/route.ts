import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { generateImage } from "@/lib/higgsfield";
import { displayUrl, saveImageFromUrl, storageEnabled } from "@/lib/storage";

export const maxDuration = 60;

const ASPECT_RATIOS = ["1:1", "4:5", "9:16", "16:9"];

export async function POST(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  if (prompt.length > 2000) return NextResponse.json({ error: "Prompt is too long" }, { status: 400 });

  const aspectRatio = typeof body?.aspectRatio === "string" && ASPECT_RATIOS.includes(body.aspectRatio) ? body.aspectRatio : undefined;

  try {
    const imageUrl = await generateImage(prompt, aspectRatio);

    // Keep our own copy in the private bucket. If the copy fails the render is not lost: it falls back to the provider's link.
    let storageKey: string | null = null;
    if (storageEnabled) {
      try {
        storageKey = await saveImageFromUrl(userId, imageUrl);
      } catch (err) {
        console.error("saving the render to storage failed", err);
      }
    }

    const generation = await db.generation.create({ data: { userId, prompt, imageUrl, storageKey } });
    return NextResponse.json({ id: generation.id, prompt, createdAt: generation.createdAt, imageUrl: await displayUrl(generation) });
  } catch (err) {
    console.error("generation failed", err);
    return NextResponse.json({ error: "Generation failed. Please try again." }, { status: 502 });
  }
}
