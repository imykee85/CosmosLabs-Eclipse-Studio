import { accessFor, gatingOn } from "@/lib/access";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { PLAN_NAME, PLAN_RANK, type PlanId } from "@/lib/access-table";
import { videoTierFor } from "@/lib/video-tier";
import type { VideoModel } from "@/lib/video-models";

export type TierRefusal = { status: 402; code: "UPGRADE"; need: PlanId; error: string };

/** Null when the workspace's plan includes this video model at this quality (see video-tier.ts), else the refusal to send (HTTP 402, code UPGRADE). */
export async function videoTierGate(workspaceId: string, personId: string | null | undefined, model: VideoModel, resolution: string | undefined): Promise<TierRefusal | null> {
  if (!clerkEnabled || !gatingOn()) return null;
  const need = videoTierFor(model, resolution);
  if (need === "starter") return null;
  const a = await accessFor(workspaceId, personId ?? null);
  if (PLAN_RANK[a.plan] >= PLAN_RANK[need]) return null;
  return { status: 402, code: "UPGRADE", need, error: `${model.label}${resolution ? ` at ${resolution}` : ""} is included in the ${PLAN_NAME[need]} plan and above. Upgrade to use it.` };
}
