import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { workspaceSession } from "@/lib/workspace";
import { db } from "@/lib/db";
import { storageEnabled } from "@/lib/storage";
import { streamStored } from "@/lib/media-link";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// The .glb, streamed from Eclipse's own address. ?download=1 saves it under the model's name.
export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!clerkEnabled || !storageEnabled) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { workspaceId: userId } = await workspaceSession();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const r = await db.model3D.findFirst({ where: { id, userId, deletedAt: null } });
  if (!r || r.status !== "completed" || !r.storageKey) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const download = new URL(req.url).searchParams.get("download") === "1";
  const base = (r.name || "model").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "model";
  return streamStored(req, r.storageKey, "model/gltf-binary", download ? { download: `${base}.glb` } : {});
}
