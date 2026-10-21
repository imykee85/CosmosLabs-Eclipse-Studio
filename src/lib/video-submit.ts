// Starts a video job on the route chosen for it: the direct BytePlus route (Seedance, routes.ts) or Higgsfield. Used by Video Studio and by Edit/Extend.
// The direct route is only used while BytePlus has room: an individual BytePlus account runs 3 tasks at once (docs/video-providers/byteplus-seedance-25.md),
// so beyond ARK_VIDEO_MAX_CONCURRENT running jobs a new one goes to Higgsfield from the start (and is priced there). If the direct start is refused before
// BytePlus accepted anything, the SAME row carries on at Higgsfield and the person pays the Higgsfield price (the hold is raised when the balance allows,
// otherwise the start fails and nothing is charged). If the outcome is unclear (a timeout) nothing is retried elsewhere, so nobody can pay twice.
import { db } from "@/lib/db";
import { freeCredits } from "@/lib/reservations";
import { submitVideo } from "@/lib/higgsfield-video";
import { arkVideoBody, ArkError, hasArkVideo, submitArk, type ArkWorkflow } from "@/lib/providers/byteplus-video";
import { routeFor, type Route } from "@/lib/routes";
import { findVideoModel, hasDirectVideoPrice } from "@/lib/video-models";

const maxDirect = () => (Number(process.env.ARK_VIDEO_MAX_CONCURRENT) > 0 ? Math.floor(Number(process.env.ARK_VIDEO_MAX_CONCURRENT)) : 3);

/**
 * The route a NEW video of this model should use right now (the price must be worked out for it before anything is held). 4K runs ONE at a time on an
 * individual BytePlus account (Seedance 2.0 only), on top of the overall limit. `inputVideoSec`: undefined = the job takes no video; a number = the total length of
 * its input videos in seconds (BytePlus bills those by tokens, see videoCreditsWithVideo); null = it takes a video of unknown length, which stays on Higgsfield
 * because it cannot be priced.
 */
export async function videoRouteNow(modelId: string, resolution?: string, inputVideoSec?: number | null): Promise<Route> {
  if (!hasArkVideo(modelId) || routeFor(modelId) !== "direct") return "higgsfield";
  if (inputVideoSec !== undefined) {
    const m = findVideoModel(modelId);
    if (inputVideoSec === null || !m || !hasDirectVideoPrice(m, resolution ?? m.live?.resolution?.default)) return "higgsfield";
  }
  const running = await db.generation.count({ where: { kind: "video", provider: "byteplus", status: "pending" } });
  if (running >= maxDirect()) return "higgsfield";
  if (resolution?.toLowerCase() === "4k" && (await db.generation.count({ where: { kind: "video", provider: "byteplus", status: "pending", resolution: { in: ["4k", "4K"] } } })) >= 1) return "higgsfield";
  return "direct";
}

export class NeedsMoreCredits extends Error {}

export type RoutedStart = { row: { id: string; userId: string; creditsHeld: number | null; params: unknown }; route: Route; modelId: string; workflow: string; endpoint: string; body: Record<string, unknown>; idemKey: string; higgsfieldCost: number | null };

/** Submits the job and records where it runs on the row. Throws on failure (the caller deletes the row, which releases the hold). */
export async function submitRouted(a: RoutedStart) {
  const params = a.row.params && typeof a.row.params === "object" && !Array.isArray(a.row.params) ? (a.row.params as Record<string, unknown>) : {};
  if (a.route === "direct") {
    try {
      const sub = await submitArk(arkVideoBody(a.modelId, a.workflow as ArkWorkflow, a.body));
      return db.generation.update({ where: { id: a.row.id }, data: { provider: "byteplus", statusUrl: sub.statusUrl, requestId: sub.taskId, cancelUrl: sub.statusUrl, params: { ...params, route: "direct" } } });
    } catch (err) {
      if (!(err instanceof ArkError) || err.ambiguous) throw err;
      console.error("direct video route refused before starting, falling back to Higgsfield", a.modelId, err.detail);
      const held = a.row.creditsHeld ?? 0;
      if (a.higgsfieldCost != null && a.higgsfieldCost > held) {
        if ((await freeCredits(a.row.userId)) < a.higgsfieldCost - held) throw new NeedsMoreCredits("This video needs more credits than you have left for the backup route.");
        await db.generation.update({ where: { id: a.row.id }, data: { creditsHeld: a.higgsfieldCost } });
      }
      params.route = "higgsfield-fallback";
    }
  }
  const sub = await submitVideo(a.endpoint, a.body, a.idemKey);
  return db.generation.update({ where: { id: a.row.id }, data: { provider: "higgsfield", statusUrl: sub.statusUrl, requestId: sub.requestId || null, cancelUrl: sub.cancelUrl, params: params as object } });
}
