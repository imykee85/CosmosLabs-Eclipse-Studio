import { randomBytes } from "node:crypto";
import { currentUser } from "@clerk/nextjs/server";
import type { Certificate } from "@prisma/client";
import { db } from "./db";
import { findAudioModel } from "./audio/registry";
import { findVideoModel } from "./video-models";
import { getModelById } from "./models";
import { sha256OfObject, storageEnabled } from "./storage";
import { claimUsage } from "./usage";

// Certificates of origin. One per finished creation (an image, a video or a voice take): a timestamped record with the SHA-256 fingerprint of the stored file and the facts
// of the creation at issue time. The public page /c/<code> shows it and lets anyone check a file against the fingerprint. Supporting evidence only, never a claim of legal ownership.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
export function newCode(): string {
  const b = randomBytes(12);
  let s = "";
  for (let i = 0; i < 12; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}
export function normalizeCode(raw: string): string | null {
  const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (c.length !== 12) return null;
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}`;
}

const shorten = (s: string, n: number) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

export type CertFacts = {
  model?: string | null; provider?: string | null; prompt?: string | null; width?: number | null; height?: number | null; aspectRatio?: string | null;
  durationSec?: number | null; hasAudio?: boolean | null; resolution?: string | null; voice?: string | null; audioKind?: string | null; madeAt: string; fileName?: string | null;
};

async function creatorName(userId: string): Promise<string> {
  try {
    const u = await currentUser();
    if (u && u.id === userId) {
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.username || u.emailAddresses[0]?.emailAddress?.split("@")[0];
      if (name) return shorten(name, 60);
    }
  } catch { /* fall through */ }
  return "Eclipse creator";
}

export type IssueResult = { ok: true; certificate: Certificate; created: boolean } | { ok: false; status: number; error: string };

/** Issues (or returns the existing) certificate for one of the person's own finished creations. */
export async function issueCertificate(userId: string, source: "render" | "audio", id: string): Promise<IssueResult> {
  if (!storageEnabled) return { ok: false, status: 503, error: "File storage is not connected, so a file cannot be fingerprinted yet." };
  const existing = await db.certificate.findUnique({ where: { userId_sourceType_sourceId: { userId, sourceType: source, sourceId: id } } });
  if (existing) return { ok: true, certificate: existing, created: false };
  if (!(await claimUsage(userId, "certificate", 20, 60_000))) return { ok: false, status: 429, error: "Too many certificates at once. Wait a moment and try again." };

  let kind: "image" | "video" | "audio";
  let key: string | null;
  let title: string;
  let contentType: string | null;
  let facts: CertFacts;
  if (source === "render") {
    const g = await db.generation.findFirst({ where: { id, userId, status: "completed", deletedAt: null } });
    if (!g || !g.storageKey) return { ok: false, status: 404, error: "Only a finished creation saved in your account can be certified." };
    kind = g.kind === "video" ? "video" : "image";
    key = g.storageKey; contentType = g.contentType;
    title = shorten(g.prompt, 90) || (kind === "video" ? "Video" : "Image");
    const label = (kind === "video" ? findVideoModel(g.model)?.label : getModelById(g.model)?.label) ?? g.model;
    facts = { model: label, provider: g.provider, prompt: g.prompt, width: g.width, height: g.height, aspectRatio: g.aspectRatio, durationSec: g.durationSec, hasAudio: g.hasAudio, resolution: g.resolution, madeAt: g.createdAt.toISOString() };
  } else {
    const a = await db.audioJob.findFirst({ where: { id, userId, status: "completed", deletedAt: null } });
    if (!a || !a.storageKey || a.kind === "stt") return { ok: false, status: 404, error: "Only a finished voice, sound or music take can be certified." };
    kind = "audio";
    key = a.storageKey; contentType = a.contentType;
    title = shorten(a.text, 90) || "Audio";
    facts = { model: findAudioModel(a.model)?.label ?? a.model, provider: a.provider, prompt: a.text, voice: a.voiceName, audioKind: a.kind, durationSec: a.durationMs ? a.durationMs / 1000 : null, madeAt: a.createdAt.toISOString() };
  }
  let fp: { sha256: string; size: number };
  try { fp = await sha256OfObject(key); }
  catch (e) { console.error("certificate fingerprint failed", e instanceof Error ? e.message : e); return { ok: false, status: 502, error: "Could not read the file to fingerprint it. Please try again." }; }
  const creator = await creatorName(userId);
  for (let tries = 0; tries < 4; tries++) {
    try {
      const certificate = await db.certificate.create({ data: { code: newCode(), userId, sourceType: source, sourceId: id, kind, title, creator, sha256: fp.sha256, sizeBytes: fp.size, contentType, facts } });
      return { ok: true, certificate, created: true };
    } catch (e) {
      // a double tap issues once: the second insert hits the unique (person, source, id) and gets the first one back
      const again = await db.certificate.findUnique({ where: { userId_sourceType_sourceId: { userId, sourceType: source, sourceId: id } } });
      if (again) return { ok: true, certificate: again, created: false };
      if (tries === 3) throw e;
    }
  }
  return { ok: false, status: 500, error: "Could not issue the certificate." };
}

/** What the owner's list needs: no key, no internals. */
export function ownerItem(c: Certificate) {
  return { id: c.id, code: c.code, kind: c.kind, title: c.title, creator: c.creator, sha256: c.sha256, sourceType: c.sourceType, sourceId: c.sourceId, showPrompt: c.showPrompt, showMedia: c.showMedia, issuedAt: c.issuedAt.toISOString(), facts: c.facts as CertFacts };
}
