import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { gateFeature } from "@/lib/access";
import { BRAND_RULE } from "@/lib/brand";
import { ChatMeter, chargeChat, chatRefusal } from "@/lib/chat-credits";
import { apiModelFor } from "@/lib/connect-models";
import { checkPrompt } from "@/lib/moderation";
import { loadPromptImages } from "@/lib/prompt-images";
import { REBUILD_SYSTEM, REBUILD_TOOL, setupFromRebuild } from "@/lib/shot/rebuild";
import { DEFAULT_SETUP } from "@/lib/shot/setup";
import { claimUsage } from "@/lib/usage";

export const maxDuration = 60;

// ShotMap: look at a picture (and the video prompt) and lay out the blockout: set, people with their poses and paths, vehicles, objects and a starting camera. Charged as chat.
export async function POST(req: Request) {
  const gated = await gateFeature("shotmap");
  if (gated) return gated;
  const u = await requireUser(); if ("fail" in u) return u.fail;
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "This is not available yet. Please try again later." }, { status: 503 });
  const body = await req.json().catch(() => null);
  const uploadId = typeof body?.uploadId === "string" ? body.uploadId.slice(0, 80) : "";
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim().slice(0, 8000) : "";
  if (!uploadId && !prompt) return NextResponse.json({ error: "Add a picture or paste the video prompt." }, { status: 400 });
  const check = checkPrompt(prompt);
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 422 });
  const broke = await chatRefusal(u.userId);
  if (broke) return NextResponse.json(broke, { status: 402 });
  if (!(await claimUsage(u.userId, "shot-rebuild", 10, 60_000))) return NextResponse.json({ error: "Too many at once. Try again in a minute." }, { status: 429 });
  const meter = new ChatMeter();
  try {
    const pics = uploadId ? await loadPromptImages(u.userId, [{ type: "upload", id: uploadId }]) : { ok: true as const, images: [] };
    if (!pics.ok) return NextResponse.json({ error: pics.error }, { status: 404 });
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });
    const content: Anthropic.ContentBlockParam[] = [...pics.images.map((i) => ({ type: "image" as const, source: { type: "base64" as const, media_type: i.mediaType, data: i.data } })), { type: "text", text: prompt ? `Video prompt:\n${prompt}` : "There is no prompt: rebuild what the picture shows." }];
    const res = await client.messages.create({ model: apiModelFor("claude-sonnet-5-5"), max_tokens: 2000, system: `${REBUILD_SYSTEM}\n\n${BRAND_RULE}`, tools: [REBUILD_TOOL], tool_choice: { type: "tool", name: "set_scene" }, messages: [{ role: "user", content }] });
    meter.add(res.model, res.usage);
    const call = res.content.find((b) => b.type === "tool_use");
    if (!call || call.type !== "tool_use") return NextResponse.json({ error: "The scene could not be rebuilt. Please try again." }, { status: 502 });
    const setup = setupFromRebuild(call.input, DEFAULT_SETUP);
    return NextResponse.json({ setup, people: setup.cast.filter((c) => c.kind === "person").length, objects: (setup.objects ?? []).length });
  } catch (err) {
    console.error("shot rebuild failed", err);
    return NextResponse.json({ error: "The scene could not be rebuilt. Please try again." }, { status: 502 });
  } finally {
    await chargeChat(u.userId, meter, "ShotMap rebuild");
  }
}
