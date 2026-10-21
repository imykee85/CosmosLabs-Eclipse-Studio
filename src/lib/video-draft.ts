import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/admin";
import { fmtCredits } from "@/lib/credit-units";
import { ArkError, arkVideoModel, submitArk } from "@/lib/providers/byteplus-video";
import { toItem, type RenderItem } from "@/lib/generation-jobs";
import { createGenerationHeld } from "@/lib/reservations";
import { refusal } from "@/lib/subscribe-alert";
import { videoSettings } from "@/lib/start-video";
import { claimUsage } from "@/lib/usage";
import { videoRouteNow } from "@/lib/video-submit";
import { findVideoModel, videoPrice } from "@/lib/video-models";

// Seedance 2.5 draft mode, step 2 (docs/video-providers/byteplus-seedance-25.md, DRAFT MODE): a finished draft (a 480p preview made with `draft: true`, see
// start-video.ts) is turned into the FINAL 1080p video by sending its task id as a `draft_task` item. Everything else (prompt, pictures, length, ratio, seed, sound) is
// reused by BytePlus and must not be sent again. The draft id lives 7 days. A final exists only at BytePlus, so there is no other route: when the direct route
// cannot take it the person is told to try later. PRICE: the 1080p direct rate for the draft's length (BytePlus bills step 2 at the 1080p rate, with the token rate
// chosen by whether step 1 had an input video); the exact token factor for a draft is NOT in the pages we have, so compare `providerUsage` with the held price on
// the first real runs. NOT tested live.
const DRAFT_DAYS = 7;

export type FinalInput = { userId: string; draftId: unknown; confirm?: unknown };
export type FinalResult = { ok: true; item: RenderItem } | { ok: false; status: number; error: string; needsConfirm?: boolean; cost?: number; code?: string };

export async function startDraftFinal(input: FinalInput): Promise<FinalResult> {
  const { userId } = input;
  const cfg = videoSettings();
  if (cfg.paused) return { ok: false, status: 503, error: "Video generation is paused right now. Please try again later." };
  const id = typeof input.draftId === "string" && input.draftId.length <= 64 ? input.draftId : "";
  const draft = id ? await db.generation.findFirst({ where: { id, userId, kind: "video", status: "completed", deletedAt: null, provider: "byteplus" } }) : null;
  const p = draft?.params && typeof draft.params === "object" && !Array.isArray(draft.params) ? (draft.params as Record<string, unknown>) : null;
  if (!draft || !p || p.draft !== true || !draft.requestId) return { ok: false, status: 404, error: "That draft could not be found." };
  if (p.finalId) return { ok: false, status: 409, error: "The final video for this draft was already started." };
  if (Date.now() - draft.createdAt.getTime() > DRAFT_DAYS * 24 * 3600_000) return { ok: false, status: 410, error: "This draft is older than 7 days and can no longer be made into a final video." };

  const model = findVideoModel("seedance_2_5");
  if (!model?.live) return { ok: false, status: 503, error: "Seedance 2.5 is not connected." };
  const secs = draft.durationSec ?? 5;
  const inputSec = typeof p.inputVideoSec === "number" ? p.inputVideoSec : undefined;
  const route = await videoRouteNow(model.id, "1080p", inputSec);
  if (route !== "direct") return { ok: false, status: 503, error: "Final videos from a draft are not available right now. Please try again in a few minutes." };
  const cost = cfg.creditsOn ? videoPrice(model, "1080p", secs, draft.hasAudio !== false, "direct", inputSec) : null;
  if (cost != null && cost > cfg.confirmAbove && input.confirm !== true) return { ok: false, status: 409, needsConfirm: true, cost, error: `This video costs ${fmtCredits(cost)} credits. Confirm to continue.` };
  const running = await db.generation.count({ where: { userId, kind: "video", status: { in: ["pending", "saving"] } } });
  if (running >= cfg.maxRunning) return { ok: false, status: 429, error: `You already have ${running} videos running. Wait for one to finish.` };
  if (!(await claimUsage(userId, "video", cfg.perMinute, 60_000))) return { ok: false, status: 429, error: "You are starting videos very quickly. Wait a moment and try again." };

  const made = await createGenerationHeld(userId, cost, {
    userId, projectId: draft.projectId, kind: "video", prompt: draft.prompt, status: "pending", statusUrl: null, requestId: null, provider: "byteplus", model: model.id,
    aspectRatio: draft.aspectRatio, resolution: "1080p", seed: draft.seed, seedLocked: draft.seedLocked, durationSec: draft.durationSec, hasAudio: draft.hasAudio, creditsHeld: cost, idemKey: randomUUID(),
    params: { workflow: "draft-final", draftOf: draft.id, duration: secs, resolution: "1080p", route: "direct", inputVideoSec: inputSec },
  });
  if (!("row" in made)) return { ok: false, status: 402, ...(await refusal(userId, `This needs ${fmtCredits(cost ?? 0)} credits. You have ${fmtCredits(Math.max(0, made.have))}.`)) };
  try {
    const sub = await submitArk({ model: arkVideoModel(model.id), content: [{ type: "draft_task", draft_task: { id: draft.requestId } }], resolution: "1080p", watermark: false });
    const row = await db.generation.update({ where: { id: made.row.id }, data: { statusUrl: sub.statusUrl, requestId: sub.taskId, cancelUrl: sub.statusUrl } });
    await db.generation.update({ where: { id: draft.id }, data: { params: { ...p, finalId: row.id } } });
    return { ok: true, item: await toItem(row) };
  } catch (err) {
    await db.generation.delete({ where: { id: made.row.id } }).catch(() => {});
    console.error("starting the final video from a draft failed", err instanceof ArkError ? err.detail : err);
    const why = (await getAdmin().catch(() => null)) && err instanceof ArkError ? ` (Owner only: ${err.detail})` : "";
    return { ok: false, status: 502, error: `The final video could not be started. Please try again.${why}` };
  }
}
