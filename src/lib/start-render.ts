import { getBalance } from "@/lib/credits";
import { db } from "@/lib/db";
import { toItem, type RenderItem } from "@/lib/generation-jobs";
import { HiggsfieldError, startGeneration } from "@/lib/higgsfield";
import { chargeFor, findEnabledModel } from "@/lib/models";
import { checkPrompt } from "@/lib/moderation";
import { parseReferenceRefs, resolveReferences } from "@/lib/references";

export type StartRenderInput = { userId: string; prompt: unknown; model: unknown; aspectRatio?: unknown; resolution?: unknown; projectId?: unknown; references?: unknown };
export type StartRenderResult = { ok: true; item: RenderItem } | { ok: false; status: number; error: string };

// The one place a render is validated and started, used by POST /api/generate and by the Connect agent, so both are
// priced, checked and recorded exactly the same way.
export async function startRender(input: StartRenderInput): Promise<StartRenderResult> {
  const { userId } = input;
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (!prompt) return { ok: false, status: 400, error: "Prompt is required" };
  if (prompt.length > 10000) return { ok: false, status: 400, error: "Prompt is too long" };

  const moderation = checkPrompt(prompt);
  if (!moderation.ok) return { ok: false, status: 422, error: moderation.reason };

  // The model must be named and available. There is no default and no fallback to a different model.
  const model = findEnabledModel(input.model);
  if (!model) return { ok: false, status: 400, error: "That model is not available." };
  if (prompt.length > model.maxPrompt) return { ok: false, status: 400, error: `${model.label} accepts prompts up to ${model.maxPrompt} characters (yours is ${prompt.length}).` };

  // Reference pictures: ids of the user's own uploads and renders, checked against the model's limits.
  const refs = parseReferenceRefs(input.references);
  if (!refs) return { ok: false, status: 400, error: "The reference pictures were not understood." };
  if (refs.length > model.maxReferences) {
    return { ok: false, status: 400, error: model.maxReferences === 0 ? `${model.label} does not take reference pictures.` : `${model.label} accepts up to ${model.maxReferences} reference picture${model.maxReferences > 1 ? "s" : ""} (you chose ${refs.length}).` };
  }
  if (model.requiresReference && refs.length === 0) return { ok: false, status: 400, error: `${model.label} edits a picture. Choose at least one reference picture.` };

  const projectId = typeof input.projectId === "string" && input.projectId.length <= 64 ? input.projectId : null;

  const aspectRatio = typeof input.aspectRatio === "string" ? input.aspectRatio : undefined;
  if (aspectRatio && !model.ratios.includes(aspectRatio)) {
    return { ok: false, status: 400, error: `${model.label} does not support the ${aspectRatio} shape. Choose one of: ${model.ratios.join(", ")}.` };
  }
  const resolution = typeof input.resolution === "string" ? input.resolution : undefined;
  if (resolution && !model.resolutions.includes(resolution)) {
    return { ok: false, status: 400, error: `${model.label} does not support the ${resolution} resolution.` };
  }

  // Credits are checked before Higgsfield is called and charged when the render finishes. A model with no credit price yet is free.
  const cost = chargeFor(model);
  if (cost != null) {
    const have = await getBalance(userId);
    if (have < cost) return { ok: false, status: 402, error: `${model.label} needs ${cost} credits and you have ${have}. Ask the owner to add more credits.` };
  }

  const resolved = await resolveReferences(userId, refs);
  if (!resolved.ok) return { ok: false, status: 400, error: resolved.error };

  try {
    const { requestId, statusUrl } = await startGeneration({ model, prompt, aspectRatio, resolution, references: resolved.urls });
    const generation = await db.generation.create({
      data: { userId, projectId, prompt, status: "pending", statusUrl, requestId: requestId || null, model: model.id, aspectRatio: aspectRatio ?? null, resolution: resolution ?? model.defaultResolution ?? null, costUsd: model.estimatedCostUsd, references: refs.length ? refs : undefined },
    });
    return { ok: true, item: await toItem(generation) };
  } catch (err) {
    console.error("starting generation failed", model.id, err);
    // Higgsfield's own rejection (bad setting, empty balance, unknown endpoint) is shown so it can be fixed fast.
    const code = err instanceof Error ? ` (${(err as { code?: string }).code ?? err.name})` : "";
    const why = err instanceof HiggsfieldError && err.detail ? ` ${model.label}: ${err.detail}` : ` Our side failed to record the render${code}.`;
    return { ok: false, status: 502, error: `Generation failed. Please try again.${why}` };
  }
}
