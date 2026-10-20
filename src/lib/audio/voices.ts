// Voice cloning and design (docs/audio-providers/build-brief.md section 5). The provider holds the voice; UserVoice is our link to it, plus the consent record for
// clones. Rules: a clone needs the person's explicit consent (stored: who, when, which wording, a hash of the sample; the sample itself is never kept), attempts
// are rate-limited, a person has at most MAX_OWN_VOICES, the flat price (credits, from config) is charged only after the provider succeeded, and deleting a voice
// deletes it at the provider too. Cloned voices are private: there is no sharing.
import { outOfCredits } from "@/lib/credit-message";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { UserVoice } from "@prisma/client";
import { InsufficientCreditsError, getBalance, spendCredits } from "@/lib/credits";
import { db } from "@/lib/db";
import { checkPrompt } from "@/lib/moderation";
import { claimUsage } from "@/lib/usage";
import { limiterFor } from "./limiter";
import { audioCreditsOn } from "./pricing";
import { ctxForProvider, providerById } from "./providers";
import { PROVIDER_LABEL, type AudioProviderId } from "./registry";
import { ProviderFailure, type Voice } from "./types";

export const CONSENT_VERSION = "2026-10-14";
export const CONSENT_TEXT = "I own this voice or have written permission to clone it.";
export const MAX_OWN_VOICES = 20;
export const MAX_SAMPLE_BYTES = 4_000_000; // the host's request limit is 4.5 MB: a 10 to 30 s sample fits easily
export const CLONE_PROVIDERS: AudioProviderId[] = ["elevenlabs", "fish", "minimax"];
export const DESIGN_PROVIDERS: AudioProviderId[] = ["elevenlabs", "fish", "minimax"];

const num = (name: string, fallback: number) => (Number(process.env[name]) > 0 ? Math.floor(Number(process.env[name])) : fallback);
// Flat prices in credits (Config values AUDIO_CLONE_CREDITS, AUDIO_DESIGN_CREDITS); null while charging is off. PROVISIONAL: provider costs are $1.50 (MiniMax clone),
// $3 (MiniMax design), Fish design $0.01, ElevenLabs not stated.
export const voiceCredits = (kind: "clone" | "design"): number | null => (audioCreditsOn() ? (kind === "clone" ? num("AUDIO_CLONE_CREDITS", 40) : num("AUDIO_DESIGN_CREDITS", 60)) : null);

export type VoiceResult<T> = ({ ok: true } & T) | { ok: false; status: number; error: string };
const fail = (status: number, error: string) => ({ ok: false as const, status, error });

// What kind of audio a sample is, from its first bytes (never from the file name or the browser's claim).
export function sniffAudio(b: Uint8Array): { mime: string; ext: string; ogg?: boolean } | null {
  const tag = (at: number, s: string) => b.length >= at + s.length && s.split("").every((c, i) => b[at + i] === c.charCodeAt(0));
  if (tag(0, "ID3") || (b.length > 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { mime: "audio/mpeg", ext: "mp3" };
  if (tag(0, "RIFF") && tag(8, "WAVE")) return { mime: "audio/wav", ext: "wav" };
  if (tag(4, "ftyp")) return { mime: "audio/mp4", ext: "m4a" };
  if (tag(0, "OggS")) return { mime: "audio/ogg", ext: "ogg", ogg: true };
  return null;
}

const cleanName = (v: unknown) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) : "");
const cleanText = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").trim().slice(0, max) : "");

// A design preview's token is the provider's own id; this signature ties it to the person it was made for, so one person cannot save another's preview.
function signKey(): string { return process.env.CONNECT_SECRET_KEY || process.env.CLERK_SECRET_KEY || "dev-only-not-secret"; }
export const signToken = (userId: string, provider: string, token: string) => createHmac("sha256", signKey()).update(`voice-design:${userId}:${provider}:${token}`).digest("hex").slice(0, 32);
function sameSig(a: string, b: string) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }

const providerLabel = (p: string) => PROVIDER_LABEL[p as AudioProviderId] ?? p;
const notConnected = (p: AudioProviderId) => fail(503, `${providerLabel(p)} voices are not available yet.`);

async function charge(userId: string, cost: number | null, note: string) {
  if (cost == null) return;
  try { await spendCredits(userId, cost, note); }
  catch (err) { if (err instanceof InsufficientCreditsError) console.error("voice price could not be charged: balance dropped meanwhile", userId); else throw err; }
}
async function enough(userId: string, cost: number | null): Promise<string | null> {
  if (cost == null) return null;
  const have = await getBalance(userId);
  return have >= cost ? null : outOfCredits("This", cost, have);
}
function failure(err: unknown, what: string): { status: number; error: string } {
  if (err instanceof ProviderFailure) {
    if (err.error.alert) console.error("AUDIO ALERT: provider needs the owner", what, err.error.code, err.error.providerCode);
    return { status: err.error.retryable ? 503 : 502, error: err.error.userMessage };
  }
  console.error(`${what} failed`, err);
  return { status: 502, error: "The voice could not be created. Please try again." };
}

export type OwnVoiceItem = { voiceId: string; ownId: string; name: string; kind: "cloned" | "designed"; provider: string; descriptive: string };
const DAY = 86_400_000;
export function toOwnItem(v: UserVoice, now = Date.now()): OwnVoiceItem {
  let line = v.kind === "cloned" ? "Your clone" : "Your design";
  if (v.provider === "minimax" && v.kind === "cloned") { // MiniMax deletes a clone that has not been used for 7 days
    const left = 7 - Math.floor((now - (v.lastUsedAt ?? v.createdAt).getTime()) / DAY);
    line = left <= 0 ? "Your clone · may have expired" : left <= 3 ? `Your clone · use within ${left} day${left === 1 ? "" : "s"}` : line;
  }
  return { voiceId: v.providerVoiceId, ownId: v.id, name: v.name, kind: v.kind === "cloned" ? "cloned" : "designed", provider: v.provider, descriptive: line };
}

export async function listOwnVoices(userId: string, provider: AudioProviderId, search?: string): Promise<Voice[]> {
  const rows = await db.userVoice.findMany({ where: { userId, provider }, orderBy: { createdAt: "desc" }, take: MAX_OWN_VOICES });
  const s = search?.toLowerCase();
  return rows.filter((r) => !s || r.name.toLowerCase().includes(s)).map((r) => { const i = toOwnItem(r); return { voiceId: i.voiceId, name: i.name, descriptive: i.descriptive, own: true, ownId: i.ownId, kind: i.kind }; });
}

export async function touchVoice(userId: string, provider: string, providerVoiceId: string): Promise<void> {
  await db.userVoice.updateMany({ where: { userId, provider, providerVoiceId }, data: { lastUsedAt: new Date() } }).catch(() => {});
}

export type CloneInput = { userId: string; provider: unknown; name: unknown; description?: unknown; consent: unknown; sample: Uint8Array | null };
export async function cloneOwnVoice(input: CloneInput): Promise<VoiceResult<{ voice: OwnVoiceItem }>> {
  const { userId } = input;
  const provider = CLONE_PROVIDERS.find((p) => p === input.provider);
  if (!provider) return fail(400, "This voice model cannot clone voices. Choose a model that can, such as Eleven, Fish or MiniMax.");
  const ctx = ctxForProvider(provider);
  if (!ctx) return notConnected(provider);
  if (input.consent !== true) return fail(400, "Confirm that you own this voice or have written permission to clone it.");
  const name = cleanName(input.name);
  if (name.length < 2) return fail(400, "Give the voice a name (at least 2 characters).");
  const description = cleanText(input.description, 300) || undefined;
  const m = checkPrompt(`${name} ${description ?? ""}`);
  if (!m.ok) return fail(422, m.reason);
  const sample = input.sample;
  if (!sample?.length) return fail(400, "Add a recording of the voice first.");
  if (sample.length > MAX_SAMPLE_BYTES) return fail(413, "That recording is too large. Use a clip under 4 MB (about a minute of MP3).");
  const kind = sniffAudio(sample);
  if (!kind || (kind.ogg && provider === "minimax")) return fail(400, provider === "minimax" ? "This model takes MP3, WAV or M4A recordings." : "That file is not an audio recording we can read. Use MP3, WAV or M4A.");
  if ((await db.userVoice.count({ where: { userId } })) >= MAX_OWN_VOICES) return fail(400, `You can keep ${MAX_OWN_VOICES} voices. Delete one first.`);
  if (!(await claimUsage(userId, "voice-clone", 5, 3600_000)) || !(await claimUsage(userId, "voice-clone-day", 20, 24 * 3600_000))) return fail(429, "You have cloned several voices very quickly. Please try again later.");
  const cost = voiceCredits("clone");
  const short = await enough(userId, cost);
  if (short) return fail(402, short);

  let voiceId: string;
  const release = await limiterFor(provider).acquire();
  try { voiceId = (await providerById(provider).cloneVoice!({ name, description, sample, mime: kind.mime, fileName: `sample.${kind.ext}` }, ctx)).voiceId; }
  catch (err) { const f = failure(err, `${provider} clone`); return fail(f.status, f.error); }
  finally { release(); }

  let row: UserVoice;
  try {
    row = await db.userVoice.create({ data: { userId, provider, providerVoiceId: voiceId, name, kind: "cloned", description: description ?? null, consentAt: new Date(), consentVersion: CONSENT_VERSION, sampleHash: createHash("sha256").update(sample).digest("hex") } });
  } catch (err) {
    console.error("saving a cloned voice failed", err);
    await providerById(provider).deleteVoice!(voiceId, "cloned", ctx).catch(() => {});
    return fail(500, "The voice was created but could not be saved. Nothing was charged.");
  }
  await charge(userId, cost, `Voice clone: ${name}`);
  return { ok: true, voice: toOwnItem(row) };
}

export type DesignPreviewItem = { token: string; sig: string; url: string; durationMs: number | null };
export async function designOwnVoice(input: { userId: string; provider: unknown; description: unknown }): Promise<VoiceResult<{ previews: DesignPreviewItem[] }>> {
  const { userId } = input;
  const provider = DESIGN_PROVIDERS.find((p) => p === input.provider);
  if (!provider) return fail(400, "This voice model cannot design voices. Choose a model that can, such as Eleven, Fish or MiniMax.");
  const ctx = ctxForProvider(provider);
  if (!ctx) return notConnected(provider);
  const description = cleanText(input.description, 1000);
  if (description.length < 20) return fail(400, "Describe the voice in at least 20 characters: age, tone, accent, pace.");
  const m = checkPrompt(description);
  if (!m.ok) return fail(422, m.reason);
  if (!(await claimUsage(userId, "voice-design", 10, 3600_000)) || !(await claimUsage(userId, "voice-design-day", 40, 24 * 3600_000))) return fail(429, "You have designed several voices very quickly. Please try again later.");
  const cost = voiceCredits("design");
  const short = await enough(userId, cost);
  if (short) return fail(402, short);

  const release = await limiterFor(provider).acquire();
  let previews;
  try { previews = await providerById(provider).designVoice!({ description }, ctx); }
  catch (err) { const f = failure(err, `${provider} design`); return fail(f.status, f.error); }
  finally { release(); }
  await charge(userId, cost, "Voice design");
  return { ok: true, previews: previews.map((p) => ({ token: p.token, sig: signToken(userId, provider, p.token), url: `data:${p.mime};base64,${Buffer.from(p.audio).toString("base64")}`, durationMs: p.durationMs ?? null })) };
}

export async function saveDesignedVoice(input: { userId: string; provider: unknown; token: unknown; sig: unknown; name: unknown; description: unknown }): Promise<VoiceResult<{ voice: OwnVoiceItem }>> {
  const { userId } = input;
  const provider = DESIGN_PROVIDERS.find((p) => p === input.provider);
  if (!provider) return fail(400, "That provider cannot design voices here.");
  const ctx = ctxForProvider(provider);
  if (!ctx) return notConnected(provider);
  const token = typeof input.token === "string" ? input.token : "";
  if (!/^[A-Za-z0-9_-]{4,128}$/.test(token) || typeof input.sig !== "string" || !sameSig(input.sig, signToken(userId, provider, token))) return fail(400, "That preview has expired. Design the voice again.");
  const name = cleanName(input.name);
  if (name.length < 2) return fail(400, "Give the voice a name (at least 2 characters).");
  const description = cleanText(input.description, 1000);
  const m = checkPrompt(`${name} ${description}`);
  if (!m.ok) return fail(422, m.reason);
  const have = await db.userVoice.findFirst({ where: { userId, provider, designToken: token } });
  if (have) return { ok: true, voice: toOwnItem(have) };
  if ((await db.userVoice.count({ where: { userId } })) >= MAX_OWN_VOICES) return fail(400, `You can keep ${MAX_OWN_VOICES} voices. Delete one first.`);
  let voiceId: string;
  try { voiceId = (await providerById(provider).saveDesign!(token, { name, description }, ctx)).voiceId; }
  catch (err) { const f = failure(err, `${provider} save design`); return fail(f.status, f.error); }
  try {
    const row = await db.userVoice.create({ data: { userId, provider, providerVoiceId: voiceId, name, kind: "designed", description: description || null, designToken: token } });
    return { ok: true, voice: toOwnItem(row) };
  } catch (err) {
    // Two saves of the same preview at once (a double tap): the other one won. Keep its voice; remove the extra one made at the provider.
    const winner = await db.userVoice.findFirst({ where: { userId, provider, designToken: token } });
    if (winner) {
      if (winner.providerVoiceId !== voiceId) await providerById(provider).deleteVoice!(voiceId, "designed", ctx).catch(() => {});
      return { ok: true, voice: toOwnItem(winner) };
    }
    console.error("saving a designed voice failed", err);
    await providerById(provider).deleteVoice!(voiceId, "designed", ctx).catch(() => {});
    return fail(500, "The voice could not be saved. Please try again.");
  }
}

export async function deleteOwnVoice(userId: string, id: string): Promise<VoiceResult<object>> {
  const v = await db.userVoice.findFirst({ where: { id, userId } });
  if (!v) return fail(404, "That voice was not found.");
  const ctx = ctxForProvider(v.provider as AudioProviderId);
  const del = providerById(v.provider as AudioProviderId)?.deleteVoice;
  if (ctx && del) {
    try { await del(v.providerVoiceId, v.kind === "cloned" ? "cloned" : "designed", ctx); }
    catch (err) { const f = failure(err, `${v.provider} delete voice`); return fail(f.status, `${f.error} The voice was not deleted; try again.`); }
  }
  await db.userVoice.delete({ where: { id } });
  return { ok: true };
}
