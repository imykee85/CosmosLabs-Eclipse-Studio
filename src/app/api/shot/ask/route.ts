import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-user";
import { gateFeature } from "@/lib/access";
import { getAdmin } from "@/lib/admin";
import { BRAND_RULE } from "@/lib/brand";
import { ChatMeter, chargeChat, chatRefusal } from "@/lib/chat-credits";
import { apiModelFor } from "@/lib/connect-models";
import { checkPrompt } from "@/lib/moderation";
import { loadPromptImages } from "@/lib/prompt-images";
import { ASK_SYSTEM, ASK_TOOL, applyAsk, worldDigest, type AskMode } from "@/lib/shot/ask";
import { emptyWorld, readWorld } from "@/lib/shot/world";
import { claimUsage } from "@/lib/usage";

export const maxDuration = 120;

const FRAME = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;
const MAX_FRAME = 900_000;

// ShotMap's assistant: builds a scene from a description or pictures, edits it, or lays out camera keyframes. Charged as chat.
export async function POST(req: Request) {
  const gated = await gateFeature("shotmap");
  if (gated) return gated;
  const u = await requireUser(); if ("fail" in u) return u.fail;
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "This is not available yet. Please try again later." }, { status: 503 });
  const body = await req.json().catch(() => null);
  const mode: AskMode = body?.mode === "build" || body?.mode === "motion" ? body.mode : "scene";
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 6000) : "";
  const refs = (Array.isArray(body?.refs) ? body.refs : []).slice(0, 4).filter((r: unknown): r is { type: "upload" | "render"; id: string } => !!r && typeof r === "object" && ((r as { type?: unknown }).type === "upload" || (r as { type?: unknown }).type === "render") && typeof (r as { id?: unknown }).id === "string").map((r: { type: "upload" | "render"; id: string }) => ({ type: r.type, id: r.id.slice(0, 80) }));
  const frames = (Array.isArray(body?.frames) ? body.frames : []).slice(0, 4).filter((f: unknown): f is string => typeof f === "string" && f.length <= MAX_FRAME && FRAME.test(f));
  if (!text && !refs.length && !frames.length) return NextResponse.json({ error: "Describe what you want first." }, { status: 400 });
  const check = checkPrompt(text);
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 422 });
  const world = mode === "build" ? readWorld(body?.world) ?? emptyWorld() : readWorld(body?.world);
  if (!world) return NextResponse.json({ error: "The scene could not be read. Reload the page and try again." }, { status: 400 });
  const broke = await chatRefusal(u.userId);
  if (broke) return NextResponse.json(broke, { status: 402 });
  if (!(await claimUsage(u.userId, "shot-ask", 12, 60_000))) return NextResponse.json({ error: "Too many at once. Try again in a minute." }, { status: 429 });
  const meter = new ChatMeter();
  try {
    const pics = refs.length ? await loadPromptImages(u.userId, refs) : { ok: true as const, images: [] };
    if (!pics.ok) return NextResponse.json({ error: pics.error }, { status: 404 });
    const content: Anthropic.ContentBlockParam[] = [
      ...pics.images.map((i) => ({ type: "image" as const, source: { type: "base64" as const, media_type: i.mediaType, data: i.data } })),
      ...frames.map((f: string) => { const m = f.match(FRAME)!; return { type: "image" as const, source: { type: "base64" as const, media_type: `image/${m[1]}` as "image/jpeg" | "image/png" | "image/webp", data: m[2] } }; }),
      { type: "text", text: `${mode === "build" ? "Build a new scene." : `Current scene:\n${worldDigest(world)}`}\n\nThe person asks:\n${text || (mode === "build" ? "Rebuild what the pictures show." : "Improve it.")}` },
    ];
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });
    const res = await client.messages.create({ model: apiModelFor("claude-sonnet-5-5"), max_tokens: 8000, system: `${ASK_SYSTEM[mode]}\n\n${BRAND_RULE}`, tools: [ASK_TOOL], messages: [{ role: "user", content }] });
    meter.add(res.model, res.usage);
    const call = res.content.find((b) => b.type === "tool_use");
    let raw: unknown = call && call.type === "tool_use" ? call.input : null;
    if (!raw) {
      // No tool call: read a JSON answer from the text instead (forcing the tool is refused while the model thinks first).
      const said = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n"), m = said.match(/\{[\s\S]*\}/);
      try { raw = m ? JSON.parse(m[0]) : null; } catch { raw = null; }
    }
    if (!raw) return NextResponse.json({ error: "That could not be done. Please try again." }, { status: 502 });
    const out = applyAsk(world, raw, mode);
    return NextResponse.json(out);
  } catch (err) {
    console.error("shot ask failed", err);
    const why = (await getAdmin().catch(() => null)) && err instanceof Error ? ` (Owner only: ${err.message.slice(0, 300)})` : "";
    return NextResponse.json({ error: `That could not be done. Please try again.${why}` }, { status: 502 });
  } finally {
    await chargeChat(u.userId, meter, "ShotMap assistant");
  }
}
