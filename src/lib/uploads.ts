import { randomUUID } from "node:crypto";
import type { Upload } from "@prisma/client";
import { readImageSize } from "./image-info";
import { putObject, signedGetUrl } from "./storage";

// Reference pictures people upload. The file's real type is read from its first bytes, never trusted from the name or the
// browser's label, and only PNG, JPEG and WebP are kept. The size cap is below the host's 4.5 MB request limit.
export const UPLOAD_KINDS = ["asset", "character", "product", "scene"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOADS_PER_USER = 300;
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export function sniffImageType(b: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && String.fromCharCode(b[0], b[1], b[2], b[3]) === "RIFF" && String.fromCharCode(b[8], b[9], b[10], b[11]) === "WEBP") return "image/webp";
  return null;
}

export const isUploadKind = (v: unknown): v is UploadKind => typeof v === "string" && (UPLOAD_KINDS as readonly string[]).includes(v);

export type StoredUpload = { key: string; contentType: string; sizeBytes: number; width: number | null; height: number | null };

export async function storeUpload(userId: string, bytes: Uint8Array): Promise<StoredUpload | { error: string }> {
  if (bytes.byteLength === 0) return { error: "That file is empty." };
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return { error: "That picture is larger than 4 MB. Please use a smaller one." };
  const contentType = sniffImageType(bytes);
  if (!contentType) return { error: "Only PNG, JPEG and WebP pictures can be uploaded." };
  const key = `u/${userId}/up-${randomUUID()}.${EXT[contentType]}`;
  await putObject(key, bytes, contentType);
  const size = readImageSize(bytes);
  return { key, contentType, sizeBytes: bytes.byteLength, width: size?.width ?? null, height: size?.height ?? null };
}

export type UploadItem = { id: string; kind: UploadKind; name: string; projectId: string | null; contentType: string; sizeBytes: number; width: number | null; height: number | null; imageUrl: string; createdAt: Date };

export async function toUploadItem(u: Upload): Promise<UploadItem> {
  return { id: u.id, kind: u.kind as UploadKind, name: u.name, projectId: u.projectId, contentType: u.contentType, sizeBytes: u.sizeBytes, width: u.width, height: u.height, imageUrl: await signedGetUrl(u.storageKey), createdAt: u.createdAt };
}
