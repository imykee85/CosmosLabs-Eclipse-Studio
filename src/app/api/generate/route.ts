import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { getBalance, InsufficientCreditsError, spendCredits } from "@/lib/credits";
import { db } from "@/lib/db";
import { generateImage, HiggsfieldError } from "@/lib/higgsfield";
import { findEnabledModel } from "@/lib/models";
import { displayUrl, saveImageFromUrl, storageEnabled } from "@/lib/storage";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  if (prompt.length > 2000) return NextResponse.json({ error: "Prompt is too long" }, { status: 400 });

  // The model must be named and available. There is no default and no fallback to a different model.
  const model = findEnabledModel(body?.model);
  if (!model) return NextResponse.json({ error: "That model is not available." }, { status: 400 });

  if (model.requiresReference) return NextResponse.json({ error: `${model.label} needs a reference image, which cannot be sent from here yet.` }, { status: 400 });

  const projectId = typeof body?.projectId === "string" && body.projectId.length <= 64 ? body.projectId : null;

  const aspectRatio = typeof body?.aspectRatio === "string" ? body.aspectRatio : undefined;
  if (aspectRatio && !model.ratios.includes(aspectRatio)) {
    return NextResponse.json({ error: `${model.label} does not support the ${aspectRatio} shape. Choose one of: ${model.ratios.join(", ")}.` }, { status: 400 });
  }
  const resolution = typeof body?.resolution === "string" ? body.resolution : undefined;
  if (resolution && !model.resolutions.includes(resolution)) {
    return NextResponse.json({ error: `${model.label} does not support the ${resolution} resolution.` }, { status: 400 });
  }

  // Credits are checked before Higgsfield is called. A model with no credit price yet is free and skips the check.
  if (model.creditCost != null && (await getBalance(userId)) < model.creditCost) {
    return NextResponse.json({ error: "You do not have enough credits for this render." }, { status: 402 });
  }

  try {
    const { imageUrl, requestId } = await generateImage({ model, prompt, aspectRatio, resolution });

    // Charge only once the render exists.
    if (model.creditCost != null) {
      try { await spendCredits(userId, model.creditCost); } catch (err) { if (!(err instanceof InsufficientCreditsError)) throw err; return NextResponse.json({ error: "You do not have enough credits for this render." }, { status: 402 }); }
    }

    // Keep our own copy in the private bucket. If the copy fails the render is not lost: it falls back to the provider's link.
    let storageKey: string | null = null;
    if (storageEnabled) {
      try {
        storageKey = await saveImageFromUrl(userId, imageUrl);
      } catch (err) {
        console.error("saving the render to storage failed", err);
      }
    }

    const generation = await db.generation.create({ data: { userId, projectId, prompt, imageUrl, storageKey, model: model.id, requestId: requestId || null, costUsd: model.estimatedCostUsd } });
    return NextResponse.json({ id: generation.id, prompt, model: model.id, createdAt: generation.createdAt, imageUrl: await displayUrl(generation) });
  } catch (err) {
    console.error("generation failed", model.id, err);
    // Higgsfield's own rejection (bad setting, empty balance, unknown endpoint) is shown so it can be fixed fast.
    const why = err instanceof HiggsfieldError && err.detail ? ` ${model.label} said ${err.detail}` : "";
    return NextResponse.json({ error: `Generation failed. Please try again.${why}` }, { status: 502 });
  }
}
