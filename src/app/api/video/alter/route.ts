import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { startVideoRender } from "@/lib/start-video";
import { workspaceSession } from "@/lib/workspace";
import { gateFeature } from "@/lib/access";
import { buildEditPrompt, EditPromptError, FEATURE_NAME } from "@/lib/video-edit/prompts";

// Eclone: change what is in one of the person's own videos and keep its performance. The prompt comes from the tested presets
// (src/lib/video-edit/prompts.ts); the job runs through the same start path as every Seedance video (limits, holds, credits, moderation).
// A 480p run is a draft: it is finished later through the draft route, the same as any Seedance draft.
export const maxDuration = 60;

const RESOLUTIONS = ["480p", "720p", "1080p"] as const;
const isId = (v: unknown): v is string => typeof v === "string" && /^[\w-]{1,64}$/.test(v);

export async function POST(req: Request) {
  const gated = await gateFeature("studios");
  if (gated) return gated;
  if (!clerkEnabled) return NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return NextResponse.json({ error: "Send the edit details." }, { status: 400 });
  if (typeof b.preset !== "string") return NextResponse.json({ error: "Choose an edit." }, { status: 400 });
  if (!isId(b.sourceVideoId)) return NextResponse.json({ error: "Choose the video to edit." }, { status: 400 });
  const imageIds = Array.isArray(b.imageIds) ? b.imageIds.filter(isId).slice(0, 1) : [];
  const resolution = RESOLUTIONS.includes(b.resolution) ? b.resolution as (typeof RESOLUTIONS)[number] : "480p";
  const values: Record<string, string> = {};
  if (b.values && typeof b.values === "object") {
    for (const [k, v] of Object.entries(b.values as Record<string, unknown>)) {
      if (/^[a-z_]{1,30}$/.test(k) && typeof v === "string") values[k] = v.slice(0, 600);
    }
  }

  let edit;
  try {
    edit = buildEditPrompt({
      preset: b.preset,
      who: typeof b.who === "string" ? b.who.slice(0, 300) : undefined,
      values,
      extra: typeof b.extra === "string" ? b.extra.slice(0, 600) : undefined,
      imageCount: imageIds.length,
      styleImage: b.styleImage === true,
    });
  } catch (err) {
    if (err instanceof EditPromptError) return NextResponse.json({ error: err.problems.join(" ") }, { status: 400 });
    throw err;
  }

  const result = await startVideoRender({
    userId,
    prompt: edit.prompt,
    model: "seedance_2_5",
    resolution,
    audio: b.newAudio === true,
    refs: imageIds.map((id: string) => ({ type: "upload", id })),
    videoRefs: [{ id: b.sourceVideoId }],
    draft: resolution === "480p",
    ...(typeof b.duration === "number" ? { duration: b.duration } : {}),
  });
  if (!result.ok) return NextResponse.json({ error: result.error, ...(result.code ? { code: result.code } : {}) }, { status: result.status });
  return NextResponse.json({ feature: FEATURE_NAME, notes: edit.notes, ...result.item });
}
