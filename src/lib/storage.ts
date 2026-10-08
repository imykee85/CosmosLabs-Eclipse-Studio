import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Private file storage on Cloudflare R2 (S3-compatible). The bucket stays private: nothing is ever served from a public address.
// Files are read back only through signed links that stop working after SIGNED_URL_TTL_SECONDS, so a leaked link expires on its own.
// Keys are unguessable (a random id under the owner's user id), never the prompt or a counter.

export const SIGNED_URL_TTL_SECONDS = 600;
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

/** A link to one stored file that works for SIGNED_URL_TTL_SECONDS and then stops. */
export function signedGetUrl(key: string, ttlSeconds = SIGNED_URL_TTL_SECONDS): Promise<string> {
  return getSignedUrl(r2(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: ttlSeconds });
}

/**
 * Copies a finished image from the provider into our bucket and returns its key.
 * The address comes from the provider's own response, but it is still treated as untrusted: https only (also after redirects), images only, size and time capped.
 */
export async function saveImageFromUrl(userId: string, sourceUrl: string): Promise<string> {
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
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("Image is empty or too large");

  const key = `u/${userId}/${randomUUID()}.${extension}`;
  await putObject(key, bytes, type);
  return key;
}

/** The address to show for a generation: a fresh signed link when the file is in our storage, else the provider's link. */
export async function displayUrl(generation: { imageUrl: string; storageKey: string | null }): Promise<string> {
  return generation.storageKey && storageEnabled ? signedGetUrl(generation.storageKey) : generation.imageUrl;
}
