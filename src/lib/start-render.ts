import { getBalance } from "@/lib/credits";
import { db } from "@/lib/db";
import { completeFromBytes, failRender, SYNC_MARK, toItem, type RenderItem } from "@/lib/generation-jobs";
import { HiggsfieldError, startGeneration } from "@/lib/higgsfield";
import { apiModelOf, chargeFor, findEnabledModel, maxRefs, minRefs, type ImageModel } from "@/lib/models";
import { checkPrompt } from "@/lib/moderation";
import { deliverReferences, parseReferenceRefs, resolveReferences } from "@/lib/references";
import { randomSeed, seedInRange } from "@/lib/seed";
import { randomUUID } from "node:crypto";
import { openaiUser } from "@/lib/providers/openai";
import { syncProvider } from "@/lib/providers";
import { ProviderError, type ReferenceImage } from "@/lib/providers/types";
import { getObjectBytes, saveImageBytes, storageEnabled } from "@/lib/storage";
import { sniffImageType } from "@/lib/uploads";
import type { ReferenceItem } from "@/lib/references";

export type StartRenderInput = { userId: string; prompt: unknown; model: unknown; aspectRatio?: unknown; resolution?: unknown; projectId?: unknown; references?: unknown; seed?: unknown; lockSeed?: unknown };
export type StartRenderResult = { ok: true; item: RenderItem; seedNote?: string } | { ok: false; status: number; error: string };

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
  if (refs.length > maxRefs(model)) {
    return { ok: false, status: 400, error: maxRefs(model) === 0 ? `${model.label} does not take reference pictures.` : `${model.label} accepts up to ${maxRefs(model)} reference picture${maxRefs(model) > 1 ? "s" : ""} (you chose ${refs.length}).` };
  }
  if (refs.length < minRefs(model)) return { ok: false, status: 400, error: `${model.label} edits a picture. Choose at least one reference picture.` };

  const projectId = typeof input.projectId === "string" && input.projectId.length <= 64 ? input.projectId : null;

  const aspectRatio = typeof input.aspectRatio === "string" ? input.aspectRatio : undefined;
  if (aspectRatio && !model.ratios.includes(aspectRatio)) {
    return { ok: false, status: 400, error: `${model.label} does not support the ${aspectRatio} shape. Choose one of: ${model.ratios.join(", ")}.` };
  }
  const resolution = typeof input.resolution === "string" ? input.resolution : undefined;
  if (resolution && !model.resolutions.includes(resolution)) {
    return { ok: false, status: 400, error: `${model.label} does not support the ${resolution} resolution.` };
  }

  // Seed. A model without a seed field is never sent one (its schema would reject it): a seed or lock that arrives is ignored and the reply says so.
  // For a model with a seed we ALWAYS send one: the user's, or (when none is locked) a random one made here, because the provider does not
  // tell us which seed it picked and a seed we cannot see can never be reused. Never null (invalid for Soul 2 and Soul Cinema).
  let seed: number | null = null;
  let seedLocked = false;
  let seedNote: string | undefined;
  const spec = model.seed;
  if (!spec.supported) {
    if (input.seed != null || input.lockSeed === true) seedNote = `${model.label} does not support seeds, so none was used.`;
  } else {
    if (input.seed != null && !seedInRange(spec, input.seed)) {
      return { ok: false, status: 400, error: `The seed must be a whole number from ${spec.min.toLocaleString("en-US")} to ${spec.max.toLocaleString("en-US")} for ${model.label}.` };
    }
    if (input.seed != null || input.lockSeed === true) {
      seedLocked = true;
      // Locked with no number: continue from the last seed used with this model, else make one (the reply carries it so it can be shown).
      seed = (input.seed as number | null | undefined) ?? (await db.generation.findFirst({ where: { userId, model: model.id, seed: { not: null } }, orderBy: { createdAt: "desc" }, select: { seed: true } }))?.seed ?? randomSeed(spec);
    } else {
      seed = randomSeed(spec);
    }
  }

  // Credits are checked before Higgsfield is called and charged when the render finishes. A model with no credit price yet is free.
  const cost = chargeFor(model);
  if (cost != null) {
    const have = await getBalance(userId);
    if (have < cost) return { ok: false, status: 402, error: `${model.label} needs ${cost} credits and you have ${have}. Ask the owner to add more credits.` };
  }

  const resolved = await resolveReferences(userId, refs);
  if (!resolved.ok) return { ok: false, status: 400, error: resolved.error };

  // Google and OpenAI hand the picture back in the reply, so their render runs right here instead of becoming a job to poll.
  if (model.provider !== "higgsfield") return runInline({ model, userId, projectId, prompt, aspectRatio, resolution, refs, items: resolved.items, seedNote });

  try {
    const { requestId, statusUrl } = await startGeneration({ model, prompt, aspectRatio, resolution, references: await deliverReferences(resolved.items), seed: seed ?? undefined });
    const generation = await db.generation.create({
      data: { userId, projectId, prompt, status: "pending", statusUrl, requestId: requestId || null, model: model.id, aspectRatio: aspectRatio ?? null, resolution: resolution ?? model.defaultResolution ?? null, costUsd: model.estimatedCostUsd, seed, seedLocked, references: refs.length ? refs : undefined },
    });
    return { ok: true, item: await toItem(generation), seedNote };
  } catch (err) {
    console.error("starting generation failed", model.id, err);
    // Higgsfield's own rejection (bad setting, empty balance, unknown endpoint) is shown so it can be fixed fast.
    const code = err instanceof Error ? ` (${(err as { code?: string }).code ?? err.name})` : "";
    const why = err instanceof HiggsfieldError && err.detail ? ` ${model.label}: ${err.detail}` : ` Our side failed to record the render${code}.`;
    return { ok: false, status: 502, error: `Generation failed. Please try again.${why}` };
  }
}


const INLINE_TIMEOUT_MS = 55_000; // the start route's time limit is 60 s

async function loadReference(it: ReferenceItem): Promise<ReferenceImage> {
  let bytes: Uint8Array;
  if (it.storageKey) bytes = await getObjectBytes(it.storageKey);
  else {
    if (new URL(it.signedUrl).protocol !== "https:") throw new Error("Refusing a non-https reference");
    const res = await fetch(it.signedUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Could not read a reference picture (${res.status})`);
    bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > 15 * 1024 * 1024) throw new Error("A reference picture is empty or too large");
  }
  return { bytes, contentType: sniffImageType(bytes) ?? it.contentType ?? "image/png" };
}

// A render by a provider that answers in the same call. The row is written BEFORE the provider is called (our own double-submit
// protection: a retry can see that the job exists, and nothing is re-submitted after a timeout), then the picture is decoded from the
// reply, copied into private storage and the row completed. A failure marks the row failed with a plain sentence.
async function runInline(a: { model: ImageModel; userId: string; projectId: string | null; prompt: string; aspectRatio?: string; resolution?: string; refs: { type: string; id: string }[]; items: ReferenceItem[]; seedNote?: string }): Promise<StartRenderResult> {
  const { model, userId } = a;
  const provider = syncProvider(model.provider);
  if (!provider || !apiModelOf(model)) return { ok: false, status: 400, error: "That model is not available." };
  // The reply carries the picture itself, so there is no provider link to fall back on: it has to go into our storage.
  if (!storageEnabled) return { ok: false, status: 503, error: "Image storage is not set up yet, so this model cannot be used." };
  const jobId = randomUUID();
  const row = await db.generation.create({
    data: { userId, projectId: a.projectId, prompt: a.prompt, status: "pending", statusUrl: `${SYNC_MARK}${jobId}`, requestId: jobId, model: model.id, provider: model.provider, aspectRatio: a.aspectRatio ?? null, resolution: a.resolution ?? model.defaultResolution ?? null, costUsd: model.estimatedCostUsd, seed: null, seedLocked: false, references: a.refs.length ? a.refs : undefined },
  });
  try {
    const references = await Promise.all(a.items.map(loadReference));
    const out = await provider.generate({ apiModel: apiModelOf(model)!, prompt: a.prompt, aspectRatio: a.aspectRatio, resolution: a.resolution ?? model.defaultResolution, references, sizing: model.sizing, sizeRule: model.sizeRule, outputPng: model.outputPng, user: model.provider === "openai" ? openaiUser(userId) : undefined, signal: AbortSignal.timeout(INLINE_TIMEOUT_MS) });
    const saved = await saveImageBytes(userId, out.bytes, out.contentType);
    return { ok: true, item: await toItem(await completeFromBytes(row, saved, out.usage)), seedNote: a.seedNote };
  } catch (err) {
    console.error("inline generation failed", model.id, err instanceof ProviderError ? err.detail : err);
    const message = err instanceof ProviderError ? err.userMessage : "Our side failed to make or save this image. Please try again.";
    await failRender(row.id, message);
    return { ok: false, status: 502, error: message };
  }
}
