import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kitItem } from "@/lib/design/motion/agent";
import { cleanKit } from "@/lib/design/motion/kits";
import { motionUser } from "@/lib/design/motion/server";

export const dynamic = "force-dynamic";

// Change a kit, or add a finished motion to it as an example ({addVersion}) so new motions follow how it moves.
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const u = await motionUser(false);
  if ("res" in u) return u.res;
  const k = await db.brandKit.findFirst({ where: { id, userId: u.userId } });
  if (!k) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await req.json().catch(() => null);
  if (typeof b?.addVersion === "string") {
    const v = await db.motionVersion.findFirst({ where: { id: b.addVersion, userId: u.userId } });
    if (!v?.code) return NextResponse.json({ error: "That motion is not finished." }, { status: 400 });
    const ex = [v.code, ...(Array.isArray(k.examples) ? (k.examples as string[]) : [])].slice(0, 4);
    return NextResponse.json(kitItem(await db.brandKit.update({ where: { id }, data: { examples: ex } })));
  }
  const c = cleanKit({ ...kitItem(k), ...(b && typeof b === "object" ? b : {}) });
  return NextResponse.json(kitItem(await db.brandKit.update({ where: { id }, data: { name: c.name || k.name, colors: c.colors, fonts: c.fonts, notes: c.notes, logos: c.logos } })));
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const u = await motionUser(false);
  if ("res" in u) return u.res;
  const r = await db.brandKit.deleteMany({ where: { id, userId: u.userId } });
  return r.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
