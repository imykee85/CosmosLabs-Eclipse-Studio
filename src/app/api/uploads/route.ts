import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { db } from "@/lib/db";
import { storageEnabled } from "@/lib/storage";
import { MAX_UPLOAD_BYTES, MAX_UPLOADS_PER_USER, isUploadKind, storeUpload, toUploadItem } from "@/lib/uploads";

export const maxDuration = 30;

function who() {
  if (!clerkEnabled) return { res: NextResponse.json({ error: "Preview mode: sign-in is not configured yet." }, { status: 503 }) };
  const { userId } = auth();
  if (!userId) return { res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { userId };
}

// The signed-in user's uploads, newest first. ?kind= takes one kind, or "ingredients" for character + product + scene.
// Every imageUrl is a fresh short-lived signed link.
export async function GET(req: Request) {
  const u = who();
  if (!u.userId) return u.res;
  if (!storageEnabled) return NextResponse.json({ items: [] });
  const kind = new URL(req.url).searchParams.get("kind");
  const where = kind === "ingredients" ? { kind: { in: ["character", "product", "scene"] } } : isUploadKind(kind) ? { kind } : {};
  try {
    const rows = await db.upload.findMany({ where: { userId: u.userId, ...where }, orderBy: { createdAt: "desc" }, take: 300 });
    return NextResponse.json({ items: await Promise.all(rows.map(toUploadItem)) });
  } catch (err) {
    console.error("listing uploads failed", err);
    return NextResponse.json({ error: "Could not load your uploads. Please try again." }, { status: 500 });
  }
}

// Upload one picture (multipart form: file, kind, name, optional projectId).
export async function POST(req: Request) {
  const u = who();
  if (!u.userId) return u.res;
  if (!storageEnabled) return NextResponse.json({ error: "File storage is not set up on this site yet." }, { status: 503 });

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) return NextResponse.json({ error: "That picture is larger than 4 MB. Please use a smaller one." }, { status: 413 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a picture to upload." }, { status: 400 });
  if (!isUploadKind(kind)) return NextResponse.json({ error: "Unknown kind." }, { status: 400 });
  const rawName = typeof form?.get("name") === "string" ? (form!.get("name") as string) : "";
  const name = (rawName.trim() || file.name.replace(/\.[^.]+$/, "")).replace(/\s+/g, " ").slice(0, 80) || "Untitled";
  const rawProject = form?.get("projectId");
  const projectId = typeof rawProject === "string" && rawProject.length > 0 && rawProject.length <= 64 ? rawProject : null;

  try {
    if ((await db.upload.count({ where: { userId: u.userId } })) >= MAX_UPLOADS_PER_USER) {
      return NextResponse.json({ error: `You have reached the limit of ${MAX_UPLOADS_PER_USER} uploads. Delete some to add more.` }, { status: 409 });
    }
    const stored = await storeUpload(u.userId, new Uint8Array(await file.arrayBuffer()));
    if ("error" in stored) return NextResponse.json({ error: stored.error }, { status: 400 });
    const row = await db.upload.create({ data: { userId: u.userId, kind, name, projectId, storageKey: stored.key, contentType: stored.contentType, sizeBytes: stored.sizeBytes, width: stored.width, height: stored.height } });
    return NextResponse.json(await toUploadItem(row));
  } catch (err) {
    console.error("upload failed", err);
    return NextResponse.json({ error: "Could not save that picture. Please try again." }, { status: 500 });
  }
}
