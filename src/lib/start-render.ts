import { AUTO_RATIO, autoTarget, resolveAutoRatio } from "@/lib/auto-ratio";
import { autoTrimEnabled, ratioString, type ConformTarget } from "@/lib/conform";
import { waitUntil } from "@vercel/functions";
import { claimUsage } from "@/lib/usage";
import { createGenerationHeld } from "@/lib/reservations";
import { claimFreeRender, freeUsedUp, giveBackFreeRender } from "@/lib/free-renders";
import { outOfCredits } from "@/lib/credit-message";
import { refusal } from "@/lib/subscribe-alert";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/admin";
import { completeFromBytes, failRender, SYNC_MARK, toItem, type RenderItem } from "@/lib/generation-jobs";
import { HiggsfieldError, startGeneration } from "@/lib/higgsfield";
import { apiModelOf, chargeFor, findEnabledModel, maxRefs, minRefs, type ImageModel } from "@/lib/models";
import { checkPrompt } from "@/lib/moderation";
import { deliverReferences, parseReferenceRefs, resolveReferences } from "@/lib/references";
import { randomSeed, seedInRange } from "@/lib/seed";
import { watchRender } from "@/lib/render-watch";
import { soulIdFields } from "@/lib/soul-id";
import { randomUUID } from "node:crypto";
import { openaiUser } from "@/lib/providers/openai";
import { syncProvider } from "@/lib/providers";
import { ProviderError, type ReferenceImage } from "@/lib/providers/types";
import { getObjectBytes, saveImageBytes, storageEnabled } from "@/lib/storage";
import { sniffImageType } from "@/lib/uploads";
import type { ReferenceItem } from "@/lib/references";

export type StartRenderInput = { userId: string; prompt: unknown; model: unknown; aspectRatio?: unknown; resolution?: unknown; projectId?: unknown; references?: unknown; seed?: unknown; lockSeed?: unknown; soulId?: unknown; soulStrength?: unknown; batchId?: unknown };
export type StartRenderResult = { ok: true; item: RenderItem; seedNote?: string } | { ok: false; status: number; error: string; code?: string };

// The one place a render is validated and started, used by POST /api/generate and by the Connect agent, so both are
// priced, checked and recorded exactly the same way.
export async function startRender(input: StartRenderInput): Promise<StartRenderResult> {
  const { userId } = input;
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (!prompt) return { ok: false, status: 400, error: "Prompt is required" };
  if (prompt.length > 10000) return { ok: false, status: 400, error: "Prompt is too long" };

  const moderation = checkPrompt(prompt);
  if (!moderation.ok) { console.warn("prompt refused", moderation.category); return { ok: false, status: 422, error: moderation.reason }; }

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
  // A Soul ID (a character trained from the person's pictures) on Soul, Soul 2 or Soul Cinema: owner-checked, finished, trained for this model.
  const soul = await soulIdFields(userId, model.id, input.soulId, input.soulStrength);
  if (!soul.ok) return { ok: false, status: 400, error: soul.error };

  let aspectRatio = typeof input.aspectRatio === "string" ? input.aspectRatio : undefined;
  // "Auto": the result takes the first reference picture's shape (nearest ratio this model offers); with no reference, the usual 1:1.
  if (aspectRatio === AUTO_RATIO && !model.ratios.includes(AUTO_RATIO)) aspectRatio = await resolveAutoRatio(input.userId, refs[0], model.ratios, model.ratios.includes("1:1") ? "1:1" : model.ratios[0]);
  // "Auto" with a reference picture: the result must end up in the REFERENCE's exact ratio. The model gets the nearest one it offers (or the exact one, if it takes any size),
  // and the stored file is trimmed to the exact ratio when it arrives in another one (src/lib/conform.ts). The target is saved on the row for that.
  const exact: ConformTarget | null = input.aspectRatio === AUTO_RATIO && !model.ratios.includes(AUTO_RATIO) ? await autoTarget(input.userId, refs[0]) : null;
  const conform = autoTrimEnabled() ? exact : null; // trimming afterwards is off by default (see conform.ts)
  if (aspectRatio && !model.ratios.includes(aspectRatio)) {
    return { ok: false, status: 400, error: `${model.label} does not support the ${aspectRatio} aspect ratio. Choose one of: ${model.ratios.join(", ")}.` };
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

  // A per-person limit on how fast renders can be started (the provider bills us for each): RENDERS_PER_MINUTE, 20 by default. Image Studio sends up to 4 at once.
  const perMinute = Number(process.env.RENDERS_PER_MINUTE) > 0 ? Math.floor(Number(process.env.RENDERS_PER_MINUTE)) : 20;
  if (!(await claimUsage(userId, "render", perMinute, 60_000))) return { ok: false, status: 429, error: "You are starting renders very quickly. Wait a moment and try again." };

  // Credits are held when the render row is created (see createGenerationHeld) and charged when the render finishes, at the price of the resolution actually sent.
  // The price is saved on the row (creditsHeld, in ledger units), so what is held, shown and charged is one number.
  const cost = chargeFor(model, resolution ?? model.defaultResolution);
  // Soul 2 and Soul Cinema: one credit pays for a batch of up to 4 images made in one Generate (the browser names the batch; the first request pays, see createGenerationHeld).
  const batch = model.batch && typeof input.batchId === "string" && /^[A-Za-z0-9-]{8,64}$/.test(input.batchId) ? { id: input.batchId, size: model.batch } : undefined;

  const resolved = await resolveReferences(userId, refs);
  if (!resolved.ok) return { ok: false, status: 400, error: resolved.error };

  // The welcome offer: a new account's first 2 image renders, on any model, cost nothing (claimed here, given back if the render fails).
  const free = cost != null && (await claimFreeRender(userId, cost));

  // Google and OpenAI hand the picture back in the reply, so their render runs right here instead of becoming a job to poll.
  if (model.provider !== "higgsfield") return runInline({ model, userId, projectId, prompt, aspectRatio, conform, exact, resolution, refs, items: resolved.items, seedNote, cost, batch, free });

  // The row exists (and the price is held) BEFORE the provider is called, so parallel requests cannot all pass the balance check.
  const made = await createGenerationHeld(userId, free ? null : cost, { ...(free ? { creditsHeld: 0 } : cost != null ? { creditsHeld: cost } : {}), userId, projectId, prompt, status: "pending", statusUrl: null, requestId: null, model: model.id, aspectRatio: aspectRatio ?? null, resolution: resolution ?? model.defaultResolution ?? null, costUsd: model.estimatedCostUsd, seed, seedLocked, references: refs.length ? refs : undefined, params: conform || soul.fields || batch || free ? { ...(free ? { free: true } : {}), ...(batch ? { batchId: batch.id } : {}), ...(conform ? { conform } : {}), ...(soul.fields ? { soulId: String(input.soulId), soulStrength: Number(soul.fields.custom_reference_strength) } : {}) } : undefined }, batch);
  if (!("row" in made)) return { ok: false, status: 402, ...(await refusal(userId, outOfCredits(model.label, cost as number, made.have, made.held, false, made.locked), made.locked > 0 && made.have < (cost as number))) };
  const pre = made.row;
  try {
    const { requestId, statusUrl } = await startGeneration({ model, prompt, aspectRatio, resolution, references: await deliverReferences(resolved.items), seed: seed ?? undefined, extra: soul.fields ?? undefined });
    const generation = await db.generation.update({ where: { id: pre.id }, data: { statusUrl, requestId: requestId || null } });
    watchRender(generation.id); // saves it in the background even if the person leaves right away
    return { ok: true, item: await toItem(generation), seedNote };
  } catch (err) {
    await db.generation.delete({ where: { id: pre.id } }).catch(() => {}); // nothing was started, so nothing stays held
    if (free) await giveBackFreeRender(userId).catch(() => {});
    console.error("starting generation failed", model.id, err);
    // People see Eclipse's own words; the provider's reply goes to the logs (and to the owner, who may need it to fix a setting fast).
    const why = (await getAdmin().catch(() => null)) && err instanceof HiggsfieldError && err.detail ? ` (Owner only: ${err.detail})` : "";
    return { ok: false, status: 502, error: `${model.label} could not start this render. Please try again in a moment.${why}` };
  }
}


const INLINE_TIMEOUT_MS = 280_000; // the start route's time limit is 300 s; the render runs after the reply has gone out

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
async function runInline(a: { model: ImageModel; userId: string; projectId: string | null; prompt: string; aspectRatio?: string; conform: ConformTarget | null; exact: ConformTarget | null; resolution?: string; refs: { type: string; id: string }[]; items: ReferenceItem[]; seedNote?: string; cost: number | null; batch?: { id: string; size: number }; free: boolean }): Promise<StartRenderResult> {
  const { model, userId } = a;
  const provider = syncProvider(model.provider);
  if (!provider || !apiModelOf(model)) { if (a.free) await giveBackFreeRender(userId).catch(() => {}); return { ok: false, status: 400, error: "That model is not available." }; }
  // The reply carries the picture itself, so there is no provider link to fall back on: it has to go into our storage.
  if (!storageEnabled) { if (a.free) await giveBackFreeRender(userId).catch(() => {}); return { ok: false, status: 503, error: "Image storage is not set up yet, so this model cannot be used." }; }
  const jobId = randomUUID();
  const made = await createGenerationHeld(userId, a.free ? null : a.cost, { ...(a.free ? { creditsHeld: 0 } : a.cost != null ? { creditsHeld: a.cost } : {}), userId, projectId: a.projectId, prompt: a.prompt, status: "pending", statusUrl: `${SYNC_MARK}${jobId}`, requestId: jobId, model: model.id, provider: model.provider, aspectRatio: a.aspectRatio ?? null, resolution: a.resolution ?? model.defaultResolution ?? null, costUsd: model.estimatedCostUsd, seed: null, seedLocked: false, references: a.refs.length ? a.refs : undefined, params: a.conform || a.batch || a.free ? { ...(a.free ? { free: true } : {}), ...(a.batch ? { batchId: a.batch.id } : {}), ...(a.conform ? { conform: a.conform } : {}) } : undefined }, a.batch);
  if (!("row" in made)) return { ok: false, status: 402, ...(await refusal(userId, outOfCredits(model.label, a.cost as number, made.have, made.held, false, made.locked), made.locked > 0 && made.have < (a.cost as number))) };
  const row = made.row;
  // The reply goes out at once with a pending row (the browser follows it like any job); the render continues after it (waitUntil, up to the route's 300 s).
  const work = (async () => {
    try {
      const references = await Promise.all(a.items.map(loadReference));
      const out = await provider.generate({ apiModel: apiModelOf(model)!, prompt: a.prompt, aspectRatio: a.exact && (model.sizing === "custom16" || model.sizeRule) ? ratioString(a.exact) : a.aspectRatio, resolution: a.resolution ?? model.defaultResolution, references, sizing: model.sizing, sizeRule: model.sizeRule, outputPng: model.outputPng, user: model.provider === "openai" ? openaiUser(userId) : undefined, signal: AbortSignal.timeout(INLINE_TIMEOUT_MS) });
      const saved = await saveImageBytes(userId, out.bytes, out.contentType, a.conform);
      await completeFromBytes(row, saved, out.usage);
    } catch (err) {
      console.error("inline generation failed", model.id, err instanceof ProviderError ? err.detail : err);
      const message = err instanceof ProviderError ? err.userMessage : "Eclipse could not make or save this image. Please try again.";
      await failRender(row.id, message, err instanceof ProviderError ? err.detail : err instanceof Error ? err.message : undefined).catch(() => {});
    }
  })();
  try { waitUntil(work); } catch { /* not on Vercel: the promise simply keeps running */ }
  return { ok: true, item: await toItem(row), seedNote: a.seedNote };
}
