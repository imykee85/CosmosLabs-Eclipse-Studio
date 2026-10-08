import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { getBalance } from "@/lib/credits";
import { db } from "@/lib/db";
import { toItem } from "@/lib/generation-jobs";
import { HiggsfieldError, startGeneration } from "@/lib/higgsfield";
import { chargeFor, findEnabledModel } from "@/lib/models";

export const maxDuration = 30;

// Starts a render and returns at once with a "pending" job. The render keeps running at Higgsfield even if the browser
// closes; GET /api/generations (or /api/generations/<id>) finishes it whenever someone next asks.
export async function POST(req: Request) {
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  if (prompt.length > 10000) return NextResponse.json({ error: "Prompt is too long" }, { status: 400 });

  // The model must be named and available. There is no default and no fallback to a different model.
  const model = findEnabledModel(body?.model);
  if (!model) return NextResponse.json({ error: "That model is not available." }, { status: 400 });
  if (prompt.length > model.maxPrompt) return NextResponse.json({ error: `${model.label} accepts prompts up to ${model.maxPrompt} characters (yours is ${prompt.length}).` }, { status: 400 });
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

  // Credits are checked before Higgsfield is called and charged when the render finishes. A model with no credit price yet is free.
  const cost = chargeFor(model);
  if (cost != null && (await getBalance(userId)) < cost) {
    return NextResponse.json({ error: "You do not have enough credits for this render." }, { status: 402 });
  }

  try {
    const { requestId, statusUrl } = await startGeneration({ model, prompt, aspectRatio, resolution });
    const generation = await db.generation.create({
      data: { userId, projectId, prompt, status: "pending", statusUrl, requestId: requestId || null, model: model.id, aspectRatio: aspectRatio ?? null, resolution: resolution ?? model.defaultResolution ?? null, costUsd: model.estimatedCostUsd },
    });
    return NextResponse.json(await toItem(generation));
  } catch (err) {
    console.error("starting generation failed", model.id, err);
    // Higgsfield's own rejection (bad setting, empty balance, unknown endpoint) is shown so it can be fixed fast.
    const code = err instanceof Error ? ` (${(err as { code?: string }).code ?? err.name})` : "";
    const why = err instanceof HiggsfieldError && err.detail ? ` ${model.label}: ${err.detail}` : ` Our side failed to record the render${code}.`;
    return NextResponse.json({ error: `Generation failed. Please try again.${why}` }, { status: 502 });
  }
}
