import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { conformImage, conformVideoFile, type ConformTarget } from "./conform";
import { readImageSize } from "./image-info";

// Private file storage on Cloudflare R2 (S3-compatible). The bucket stays private: nothing is ever served from a public address.
// Files are read back only through signed links that stop working after SIGNED_URL_TTL_SECONDS, so a leaked link expires on its own.
// Keys are unguessable (a random id under the owner's user id), never the prompt or a counter.

const SIGNED_URL_TTL_SECONDS = 600;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;
const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

const REQUIRED = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const;

/** False in previews without R2 variables: callers then keep using the provider's own link. */
export const storageEnabled = REQUIRED.every((name) => Boolean(process.env[name]));

let client: S3Client | undefined;

function r2() {
  if (!storageEnabled) throw new Error("Storage is not configured (R2_* variables are missing)");
  client ??= new S3Client({
    region: "auto",
    forcePathStyle: true, // https://<account>.r2.cloudflarestorage.com/<bucket>/<key>
    // R2_ENDPOINT is only for pointing tests at a local S3-compatible server.
    endpoint: process.env.R2_ENDPOINT ?? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
    // R2 does not accept the extra checksum headers newer SDK versions add by default.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

const bucket = () => process.env.R2_BUCKET!;

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  await r2().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
}

export async function deleteObject(key: string): Promise<void> {
  await r2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/** The stored file's bytes (used to hand a reference picture to the provider's own upload). Pictures are capped well below this. */
export async function getObjectBytes(key: string, maxBytes = 15 * 1024 * 1024): Promise<Uint8Array> {
  const res = await r2().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  const bytes = await res.Body?.transformToByteArray();
  if (!bytes || bytes.byteLength === 0 || bytes.byteLength > maxBytes) throw new Error("Stored file is empty or too large");
  return bytes;
}

/** A one-time link the BROWSER can PUT a file to directly (so it never passes through our server's request-size limit). Works for `ttlSeconds`. */
export function signedPutUrl(key: string, contentType: string, ttlSeconds = 3600): Promise<string> {
  return getSignedUrl(r2(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }), { expiresIn: ttlSeconds });
}

/** Size and type of a stored file, or null when it does not exist. */
export async function headObjectInfo(key: string): Promise<{ size: number; contentType: string | null } | null> {
  try {
    const r = await r2().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { size: Number(r.ContentLength ?? 0), contentType: r.ContentType ?? null };
  } catch { return null; }
}

/** The first `length` bytes of a stored file (to read its real type without fetching all of it). */
export async function getObjectHead(key: string, length = 65536): Promise<Uint8Array> {
  const res = await r2().send(new GetObjectCommand({ Bucket: bucket(), Key: key, Range: `bytes=0-${length - 1}` }));
  const bytes = await res.Body?.transformToByteArray();
  if (!bytes) throw new Error("Stored file is empty");
  return bytes;
}

/** Copies one stored file to a local path as a stream (for tools that need a real file, such as ffmpeg). */
export async function downloadObjectToFile(key: string, dest: string, maxBytes = 300 * 1024 * 1024): Promise<number> {
  const res = await r2().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!res.Body) throw new Error("Stored file is empty");
  let seen = 0;
  const limit = new Transform({ transform(chunk, _enc, cb) { seen += chunk.length; cb(seen > maxBytes ? new Error("Stored file is too large") : null, chunk); } });
  await pipeline(res.Body as Readable, limit, createWriteStream(dest));
  return seen;
}

/** A link to one stored file that works for SIGNED_URL_TTL_SECONDS and then stops. */
export function signedGetUrl(key: string, ttlSeconds = SIGNED_URL_TTL_SECONDS): Promise<string> {
  return getSignedUrl(r2(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: ttlSeconds });
}

/**
 * Copies a finished image from the provider into our bucket and returns its key plus the file's facts (type, size, dimensions).
 * The address comes from the provider's own response, but it is still treated as untrusted: https only (also after redirects), images only, size and time capped.
 */
export type SavedImage = { key: string; contentType: string; sizeBytes: number; width: number | null; height: number | null; conformed?: boolean };

// "Auto" aspect ratio with a reference: trims the finished picture to the reference's exact ratio before it is stored (conform.ts). On any failure the original is kept.
async function conformed(bytes: Uint8Array, type: string, target: ConformTarget | null | undefined): Promise<{ bytes: Uint8Array; type: string; done: boolean }> {
  if (!target) return { bytes, type, done: false };
  const r = await conformImage(bytes, type, target).catch(() => null);
  if (r === "ok") return { bytes, type, done: true };
  if (r) return { bytes: r.bytes, type: r.type, done: true };
  console.error("could not trim the picture to the reference aspect ratio; the original is kept");
  return { bytes, type, done: false };
}

export async function saveImageFromUrl(userId: string, sourceUrl: string, conform?: ConformTarget | null): Promise<SavedImage> {
  const url = new URL(sourceUrl);
  if (url.protocol !== "https:") throw new Error("Refusing to fetch a non-https image address");

  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Could not download the image (${res.status})`);
  if (new URL(res.url).protocol !== "https:") throw new Error("Refusing an image that redirected away from https");

  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const extension = EXTENSIONS[type];
  if (!extension) throw new Error(`Unsupported image type: ${type || "unknown"}`);

  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_IMAGE_BYTES) throw new Error("Image is too large");
  const original = new Uint8Array(await res.arrayBuffer());
  if (original.byteLength === 0 || original.byteLength > MAX_IMAGE_BYTES) throw new Error("Image is empty or too large");

  const c = await conformed(original, type, conform);
  const bytes = c.bytes;
  const key = `u/${userId}/${randomUUID()}.${EXTENSIONS[c.type]}`;
  await putObject(key, bytes, c.type);
  const size = readImageSize(bytes);
  return { key, contentType: c.type, sizeBytes: bytes.byteLength, width: size?.width ?? null, height: size?.height ?? null, conformed: c.done };
}

/** Stores a picture that arrived as bytes (Google and OpenAI send it inside the reply, not as an address). Same key layout and facts as saveImageFromUrl. */
export async function saveImageBytes(userId: string, original: Uint8Array, type: string, conform?: ConformTarget | null): Promise<SavedImage> {
  if (!EXTENSIONS[type]) throw new Error(`Unsupported image type: ${type || "unknown"}`);
  if (original.byteLength === 0 || original.byteLength > MAX_IMAGE_BYTES) throw new Error("Image is empty or too large");
  const c = await conformed(original, type, conform);
  const bytes = c.bytes;
  const key = `u/${userId}/${randomUUID()}.${EXTENSIONS[c.type]}`;
  await putObject(key, bytes, c.type);
  const size = readImageSize(bytes);
  return { key, contentType: c.type, sizeBytes: bytes.byteLength, width: size?.width ?? null, height: size?.height ?? null, conformed: c.done };
}

/** The address to show for a generation: a fresh signed link when the file is in our storage, else the provider's link. */
export async function displayUrl(generation: { imageUrl: string; storageKey: string | null; kind?: string }): Promise<string> {
  if (generation.storageKey && storageEnabled) return generation.kind === "video" ? signedMediaUrl(generation.storageKey, { ttlSeconds: 3600 }) : signedGetUrl(generation.storageKey);
  return generation.imageUrl;
}

/** The stored file itself (or the provider's copy when it never reached our storage), streamed back for download and sharing. */
export async function openImage(generation: { imageUrl: string; storageKey: string | null }): Promise<Response> {
  const url = generation.storageKey && storageEnabled ? await signedGetUrl(generation.storageKey, 60) : generation.imageUrl;
  if (new URL(url).protocol !== "https:") throw new Error("Refusing a non-https image address");
  return fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

// --- Video ------------------------------------------------------------------------------------------------------------------------------------------------------
// A finished video is copied from the provider into the private bucket as a STREAM (multipart upload), never held in memory: the address is the provider's
// own, but still untrusted (https only, also after redirects, video types only, a size cap and a time cap). The key is fixed per render, so a retry after a
// half-finished copy overwrites the same object instead of leaving strays.
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const VIDEO_COPY_TIMEOUT_MS = 280_000;
const VIDEO_EXT: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };
export type SavedVideo = { key: string; contentType: string; sizeBytes: number; conformed?: boolean };
const MAX_CONFORM_BYTES = 150 * 1024 * 1024; // a larger clip is stored as the model made it: re-encoding it would not finish inside the function time limit

export async function saveVideoFromUrl(userId: string, generationId: string, sourceUrl: string, conform?: ConformTarget | null): Promise<SavedVideo> {
  const url = new URL(sourceUrl);
  if (url.protocol !== "https:") throw new Error("Refusing to fetch a non-https video address");
  const res = await fetch(url, { signal: AbortSignal.timeout(VIDEO_COPY_TIMEOUT_MS) });
  if (!res.ok || !res.body) throw new Error(`Could not download the video (${res.status})`);
  if (new URL(res.url).protocol !== "https:") throw new Error("Refusing a video that redirected away from https");

  // Providers sometimes serve a video as application/octet-stream: fall back to the file name's extension.
  let type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!VIDEO_EXT[type]) {
    const byName = new URL(res.url).pathname.toLowerCase().endsWith(".mov") ? "video/quicktime" : new URL(res.url).pathname.toLowerCase().endsWith(".webm") ? "video/webm" : "video/mp4";
    if (type && type !== "application/octet-stream" && type !== "binary/octet-stream" && !type.startsWith("video/")) throw new Error(`Unsupported video type: ${type}`);
    type = byName;
  }
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_VIDEO_BYTES) throw new Error("Video is too large");

  let bytes = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      bytes += chunk.length;
      if (bytes > MAX_VIDEO_BYTES) cb(new Error("Video is too large"));
      else cb(null, chunk);
    },
  });
  // "Auto" aspect ratio with a reference: the clip goes through a temporary file so it can be trimmed to the reference's exact ratio (conform.ts) before it is stored.
  if (conform && declared <= MAX_CONFORM_BYTES) {
    const dir = await mkdtemp(join(tmpdir(), "eclipse-conform-"));
    try {
      const inFile = join(dir, "in");
      const outFile = join(dir, "out.mp4");
      let seen = 0;
      const cap = new Transform({ transform(chunk: Buffer, _enc, cb) { seen += chunk.length; cb(seen > MAX_VIDEO_BYTES ? new Error("Video is too large") : null, chunk); } });
      await pipeline(Readable.fromWeb(res.body as never), cap, createWriteStream(inFile));
      if (seen === 0) throw new Error("Video is empty");
      const result = seen <= MAX_CONFORM_BYTES ? await conformVideoFile(inFile, outFile, conform) : false;
      if (result === false) console.error("could not trim the clip to the reference aspect ratio; the original is kept");
      const useOut = result === true;
      const file = useOut ? outFile : inFile;
      const outType = useOut ? "video/mp4" : type;
      const k = `video/${userId}/${generationId}.${useOut ? "mp4" : VIDEO_EXT[type]}`;
      const up = new Upload({ client: r2(), params: { Bucket: bucket(), Key: k, Body: createReadStream(file), ContentType: outType }, queueSize: 3, partSize: 8 * 1024 * 1024, leavePartsOnError: false });
      await up.done();
      return { key: k, contentType: outType, sizeBytes: (await stat(file)).size, conformed: result !== false };
    } finally { await rm(dir, { recursive: true, force: true }).catch(() => {}); }
  }
  const key = `video/${userId}/${generationId}.${VIDEO_EXT[type]}`;
  const upload = new Upload({ client: r2(), params: { Bucket: bucket(), Key: key, Body: Readable.fromWeb(res.body as never).pipe(counter), ContentType: type }, queueSize: 3, partSize: 8 * 1024 * 1024, leavePartsOnError: false });
  await upload.done();
  if (bytes === 0) { await deleteObject(key).catch(() => {}); throw new Error("Video is empty"); }
  return { key, contentType: type, sizeBytes: bytes };
}

/** A signed link for a stored media file. Videos get a longer life so a long watch or a seek does not hit an expired link; R2 serves ranges, so seeking works on iPhone. `download` makes the browser save it under that name. */
export function signedMediaUrl(key: string, opts: { ttlSeconds?: number; download?: string; contentType?: string } = {}): Promise<string> {
  return getSignedUrl(r2(), new GetObjectCommand({ Bucket: bucket(), Key: key, ...(opts.download ? { ResponseContentDisposition: `attachment; filename="${opts.download.replace(/"/g, "")}"` } : {}), ...(opts.contentType ? { ResponseContentType: opts.contentType } : {}) }), { expiresIn: opts.ttlSeconds ?? 3600 });
}
