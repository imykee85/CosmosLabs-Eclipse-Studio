import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatRefusal } from "@/lib/chat-credits";
import { claimUsage } from "@/lib/usage";
import { kitItem } from "@/lib/design/motion/agent";
import { cleanKit, kitFromMaterial } from "@/lib/design/motion/kits";
import { colorsInCode } from "@/lib/design/motion/spec";
import { motionUser } from "@/lib/design/motion/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const u = await motionUser(false);
  if ("res" in u) return u.res.status === 503 ? NextResponse.json({ items: [] }) : u.res;
  const rows = await db.brandKit.findMany({ where: { userId: u.userId }, orderBy: { updatedAt: "desc" }, take: 40 });
  return NextResponse.json({ items: rows.map(kitItem) });
}

// A new kit: by hand ({name, colors, fonts, notes, logos}), read from a website ({fromUrl}) or text ({fromText}), or from a motion ({fromVersion}).
export async function POST(req: Request) {
  const u = await motionUser();
  if ("res" in u) return u.res;
  if ((await db.brandKit.count({ where: { userId: u.userId } })) >= 40) return NextResponse.json({ error: "You have 40 brand kits. Delete one first." }, { status: 400 });
  if (!(await claimUsage(u.userId, "brand-kit", 10, 60_000))) return NextResponse.json({ error: "Too many at once. Try again in a minute." }, { status: 429 });
  const b = await req.json().catch(() => null);
  let draft = cleanKit(b);
  let examples: string[] = [];
  if (typeof b?.fromVersion === "string") {
    const v = await db.motionVersion.findFirst({ where: { id: b.fromVersion, userId: u.userId } });
    if (!v?.code) return NextResponse.json({ error: "That motion is not finished." }, { status: 400 });
    const m = await db.motion.findUnique({ where: { id: v.motionId } });
    draft = { ...draft, name: draft.name || `${m?.title ?? "Motion"} kit`, colors: draft.colors.length ? draft.colors : colorsInCode(v.code), notes: draft.notes || "Motion style taken from the example motion." };
    examples = [v.code];
  } else if (typeof b?.fromUrl === "string" || typeof b?.fromText === "string") {
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "This is not available yet." }, { status: 503 });
    const broke = await chatRefusal(u.userId); // reading a website or text is a model call: needs credits like every other one
    if (broke) return NextResponse.json(broke, { status: 402 });
    const r = await kitFromMaterial(u.userId, { url: typeof b.fromUrl === "string" ? b.fromUrl.slice(0, 500) : undefined, text: typeof b.fromText === "string" ? b.fromText : undefined });
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    const c = cleanKit(r);
    draft = { ...c, name: draft.name || c.name || "Brand kit", logos: draft.logos };
  }
  if (!draft.name) return NextResponse.json({ error: "Give the kit a name." }, { status: 400 });
  const k = await db.brandKit.create({ data: { userId: u.userId, name: draft.name, colors: draft.colors, fonts: draft.fonts, logos: draft.logos, notes: draft.notes, examples } });
  return NextResponse.json(kitItem(k));
}
