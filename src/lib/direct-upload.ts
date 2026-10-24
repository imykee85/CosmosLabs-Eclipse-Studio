import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { readImageSize } from "@/lib/image-info";
import { deleteObject, getObjectBytes, getObjectHead, headObjectInfo, putObject, signedGetUrl, signedPutUrl, storageEnabled } from "@/lib/storage";
import { MAX_UPLOADS_PER_USER, convertPicture, isUploadKind, sniffImageType, type UploadKind } from "@/lib/uploads";
import { scanUpload } from "@/lib/upload-scan";
import { frameAt, probeVideo, shrinkPicture, spacedTimes } from "@/lib/video-frames";

// Big uploads go from the browser straight to storage (a one-time signed link), because the host rejects any request to our own server over about 4.5 MB.
// Two steps: `startUpload` checks the plan and hands out the link; `finishUpload` runs AFTER the file is in storage: it reads the real type from the file's
// first bytes (never the browser's label), runs the automatic content check, makes the stored copy a sensible size and only then records it. A file that fails
// any check is deleted from storage again.
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 600;
const KEEP_IMAGE_BYTES = 10 * 1024 * 1024;   // a stored picture is never larger than this: a bigger original is redrawn (JPEG, at most 4096 px wide); providers take about 10 MB
const SCAN_FRAMES = 6;

// Any picture or video the browser hands over is accepted; the real type is read from the file's bytes when it is finished.
const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const VIDEO_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };

export type StartInput = { fileKind: "image" | "video"; contentType: string; size: number };
export function planUpload(i: StartInput): { ok: true; key: (userId: string) => string; ext: string } | { ok: false; error: string } {
  if (i.fileKind !== "image" && i.fileKind !== "video") return { ok: false, error: "Unknown kind of file." };
  const typeOk = i.contentType.startsWith(`${i.fileKind}/`) || i.contentType === "";
  if (!typeOk) return { ok: false, error: `That file is not a ${i.fileKind} we can read.` };
  const table = i.fileKind === "image" ? IMAGE_TYPES : VIDEO_TYPES;
  const ext = table[i.contentType] ?? (i.fileKind === "image" ? "img" : "vid");
  if (!Number.isFinite(i.size) || i.size <= 0) return { ok: false, error: "That file is empty." };
  const max = i.fileKind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (i.size > max) return { ok: false, error: `That ${i.fileKind} is larger than ${Math.round(max / 1024 / 1024)} MB. Please use a smaller one.` };
  return { ok: true, ext, key: (userId) => `u/${userId}/${i.fileKind === "image" ? "up" : "vid"}-${randomUUID()}.${ext}` };
}

export async function startUpload(userId: string, i: StartInput): Promise<{ ok: true; url: string; key: string } | { ok: false; status: number; error: string }> {
  if (!storageEnabled) return { ok: false, status: 503, error: "File storage is not set up on this site yet." };
  const plan = planUpload(i);
  if (!plan.ok) return { ok: false, status: 400, error: plan.error };
  if (i.fileKind === "image" && (await db.upload.count({ where: { userId } })) >= MAX_UPLOADS_PER_USER) return { ok: false, status: 409, error: `You have reached the limit of ${MAX_UPLOADS_PER_USER} uploads. Delete some to add more.` };
  const key = plan.key(userId);
  return { ok: true, key, url: await signedPutUrl(key, i.contentType) };
}

// The key must be one this person was handed (their own folder, our file-name pattern) and not already recorded.
export function ownKey(userId: string, key: unknown, fileKind: "image" | "video"): key is string {
  return typeof key === "string" && key.length < 200 && new RegExp(`^u/${userId.replace(/[^A-Za-z0-9_-]/g, "")}/${fileKind === "image" ? "up" : "vid"}-[0-9a-f-]{36}\\.(png|jpg|webp|img|mp4|mov|webm|mkv|avi|m4v|3gp|vid)$`).test(key) && key.startsWith(`u/${userId}/`);
}

const refuse = async (key: string, status: number, error: string): Promise<{ ok: false; status: number; error: string }> => { await deleteObject(key).catch(() => {}); return { ok: false, status, error }; };

export async function finishImage(userId: string, originalKey: string, meta: { kind: unknown; name: unknown; projectId: unknown }) {
  const kind: UploadKind = isUploadKind(meta.kind) ? meta.kind : "asset";
  const name = (typeof meta.name === "string" ? meta.name.trim() : "").replace(/\s+/g, " ").slice(0, 80) || "Untitled";
  const projectId = typeof meta.projectId === "string" && meta.projectId.length > 0 && meta.projectId.length <= 64 ? meta.projectId : null;
  if (await db.upload.findFirst({ where: { storageKey: originalKey }, select: { id: true } })) return { ok: false as const, status: 409, error: "That file was already added." };
  const head = await headObjectInfo(originalKey);
  if (!head) return { ok: false as const, status: 404, error: "The upload did not arrive. Please try again." };
  if (head.size <= 0 || head.size > MAX_IMAGE_BYTES) return refuse(originalKey, 413, `That picture is larger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB. Please use a smaller one.`);
  let key = originalKey;
  let bytes = await getObjectBytes(key, MAX_IMAGE_BYTES);
  let type = sniffImageType(bytes);
  if (!type) {
    // Any other picture format is redrawn as PNG or JPEG, and the original is removed from storage.
    const converted = await convertPicture(bytes);
    if (!converted) return refuse(key, 400, "That file is not a picture we can read.");
    bytes = converted.bytes; type = converted.contentType;
    const newKey = key.replace(/\.[a-z0-9]+$/, type === "image/png" ? ".png" : ".jpg");
    await putObject(newKey, bytes, type);
    await deleteObject(key).catch(() => {});
    key = newKey;
  }

  // The content check takes a picture the model accepts (under 5 MB): a big one is looked at in a smaller copy.
  let look: Uint8Array = bytes, lookType = type;
  if (bytes.byteLength > 3_000_000) {
    const small = await shrinkPicture(bytes);
    if (!small) return refuse(key, 400, "That picture could not be read. Try saving it again as a JPEG or PNG.");
    look = small; lookType = "image/jpeg";
  }
  const scan = await scanUpload(look, lookType);
  if (!scan.ok) return refuse(key, scan.status, scan.error);

  // A stored picture stays at a size every provider takes.
  let storedKey = key;
  if (bytes.byteLength > KEEP_IMAGE_BYTES) {
    // Redrawn as a JPEG: first large and fine, then smaller and softer until it fits (a very noisy picture needs the later steps).
    let redrawn: Buffer | null = null;
    for (const [width, quality] of [[4096, 3], [3000, 5], [2048, 8]] as const) {
      redrawn = await shrinkPicture(bytes, width, quality);
      if (redrawn && redrawn.byteLength <= KEEP_IMAGE_BYTES) break;
    }
    if (!redrawn || redrawn.byteLength > KEEP_IMAGE_BYTES) return refuse(key, 400, "That picture is too large and could not be made smaller.");
    storedKey = key.replace(/\.[a-z]+$/, ".jpg");
    await putObject(storedKey, new Uint8Array(redrawn), "image/jpeg");
    if (storedKey !== key) await deleteObject(key).catch(() => {});
    bytes = new Uint8Array(redrawn); type = "image/jpeg";
  }
  const size = readImageSize(bytes);
  const row = await db.upload.create({ data: { userId, kind, name, projectId, storageKey: storedKey, contentType: type, sizeBytes: bytes.byteLength, width: size?.width ?? null, height: size?.height ?? null } });
  return { ok: true as const, item: row };
}

// MP4, MOV, M4V, 3GP (ftyp box), Matroska and WebM (EBML), AVI (RIFF). ffmpeg reads them all; the providers take the ones they accept.
const sniffVideo = (b: Uint8Array) => (b.length > 12 && String.fromCharCode(b[4], b[5], b[6], b[7]) === "ftyp")
  || (b.length > 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3)
  || (b.length > 12 && String.fromCharCode(b[0], b[1], b[2], b[3]) === "RIFF" && String.fromCharCode(b[8], b[9], b[10], b[11]) === "AVI ");

const ratioOf = (w: number, h: number) => {
  const r = w / h;
  const known: [string, number][] = [["16:9", 16 / 9], ["9:16", 9 / 16], ["1:1", 1], ["4:3", 4 / 3], ["3:4", 3 / 4], ["21:9", 21 / 9], ["3:2", 3 / 2], ["2:3", 2 / 3]];
  return known.reduce((a, b) => (Math.abs(b[1] - r) < Math.abs(a[1] - r) ? b : a))[0];
};

// An uploaded video becomes an ordinary finished video in the person's library (a Generation row with no model), so the Library, Gallery, the "My videos"
// picker (reference clips, motion transfer) and Atlas's video watching all work on it without special cases.
export async function finishVideo(userId: string, key: string, meta: { name: unknown; projectId: unknown }) {
  const name = (typeof meta.name === "string" ? meta.name.trim() : "").replace(/\s+/g, " ").slice(0, 80) || "Uploaded video";
  const projectId = typeof meta.projectId === "string" && meta.projectId.length > 0 && meta.projectId.length <= 64 ? meta.projectId : null;
  if (await db.generation.findFirst({ where: { storageKey: key }, select: { id: true } })) return { ok: false as const, status: 409, error: "That file was already added." };
  const head = await headObjectInfo(key);
  if (!head) return { ok: false as const, status: 404, error: "The upload did not arrive. Please try again." };
  if (head.size <= 0 || head.size > MAX_VIDEO_BYTES) return refuse(key, 413, `That video is larger than ${MAX_VIDEO_BYTES / 1024 / 1024} MB. Please use a smaller one.`);
  if (!sniffVideo(await getObjectHead(key, 64))) return refuse(key, 400, "That file is not a video we can read.");

  // ffmpeg reads the file straight from storage through a short-lived link (range requests), so a 500 MB video is never copied to this server.
  const src = await signedGetUrl(key, 900);
  const info = await probeVideo(src);
  if (!info) return refuse(key, 400, "That video could not be read. Try exporting it again as an MP4 (H.264).");
  if (info.duration > MAX_VIDEO_SECONDS) return refuse(key, 400, `That video is longer than ${MAX_VIDEO_SECONDS / 60} minutes. Please trim it.`);

  // The automatic content check looks at frames spread across the video (it is a safety net, not proof of ownership).
  const shots = await Promise.all(spacedTimes(0, info.duration, SCAN_FRAMES).map((t) => frameAt(src, t, 768).catch(() => null)));
  const frames = shots.filter((s): s is Buffer => !!s);
  if (!frames.length) return refuse(key, 400, "That video could not be read. Try exporting it again as an MP4 (H.264).");
  for (const f of frames) {
    const scan = await scanUpload(new Uint8Array(f), "image/jpeg");
    if (!scan.ok) return refuse(key, scan.status, scan.error.replace("picture", "video"));
  }
  const contentType = key.endsWith(".mp4") ? "video/mp4" : key.endsWith(".mov") ? "video/quicktime" : "video/webm";
  const row = await db.generation.create({ data: { userId, projectId, prompt: name, status: "completed", kind: "video", imageUrl: "", storageKey: key, contentType, sizeBytes: head.size, durationSec: Math.round(info.duration * 10) / 10, hasAudio: info.hasAudio, aspectRatio: ratioOf(info.width, info.height), width: info.width, height: info.height, params: { uploaded: true }, finishedAt: new Date() } });
  return { ok: true as const, item: row };
}
