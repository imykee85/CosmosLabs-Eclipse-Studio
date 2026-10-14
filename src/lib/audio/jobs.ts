// Voice Studio jobs (docs/audio-providers/build-brief.md sections 3 and 4). A job is a row: startAudioJob validates, holds the price and returns at once; the
// provider call runs in the background (waitUntil) and the browser asks GET /api/audio/<id>. The raw provider text never reaches a person: only ProviderError.userMessage.
import { createHash, randomUUID } from "node:crypto";
import type { AudioJob } from "@prisma/client";
import { waitUntil } from "@vercel/functions";
import { db } from "@/lib/db";
import { checkPrompt } from "@/lib/moderation";
import { createAudioJobHeld } from "@/lib/reservations";
import { deleteObject, putObject, signedMediaUrl, storageEnabled } from "@/lib/storage";
import { claimUsage } from "@/lib/usage";
import { joinMp3, mp3DurationMs, splitForTts } from "./chunk";
import { limiterFor } from "./limiter";
import { audioCreditsOn, creditsFor, ttsCredits, usdFor } from "./pricing";
import { ctxFor, providerFor } from "./providers";
import { findAudioModel, type AudioModel } from "./registry";
import { withRetry } from "./retry";
import { ProviderFailure, type AudioRequest } from "./types";

const num = (name: string, fallback: number) => (Number(process.env[name]) > 0 ? Math.floor(Number(process.env[name])) : fallback);
export const audioSettings = () => ({
  paused: process.env.AUDIO_KILL_SWITCH === "1",     // set to 1 and every new audio job is refused (running ones finish)
  perMinute: num("AUDIO_JOBS_PER_MINUTE", 10),
  perDay: num("AUDIO_JOBS_PER_DAY", 100),
  maxRunning: num("AUDIO_MAX_RUNNING", 3),
});

const STALE_NOT_STARTED_MS = 2 * 60_000;   // the row exists a moment before the background run begins
const STALE_RUNNING_MS = 8 * 60_000;       // a run that has not finished by now died with its function (300 s limit)
const SIGNED_TTL_S = 3600;

export type AudioItem = {
  id: string; status: "pending" | "completed" | "failed"; error: string | null; text: string; chars: number; model: string; modelLabel: string;
  voiceId: string | null; voiceName: string | null; createdAt: string; durationMs: number | null; contentType: string | null; sizeBytes: number | null; url: string | null; fileName: string;
};

const EXT: Record<string, string> = { "audio/mpeg": "mp3", "audio/wav": "wav" };
export const fileNameOf = (j: Pick<AudioJob, "id" | "model" | "createdAt" | "contentType">) => {
  const t = j.createdAt.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `${j.model.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${t.slice(0, 8)}-${t.slice(8)}-${j.id.slice(-6)}.${EXT[j.contentType ?? ""] ?? "mp3"}`;
};

// A row for the browser: never the raw record (no storage key, provider usage or hashes).
export async function toAudioItem(j: AudioJob): Promise<AudioItem> {
  let url: string | null = null;
  if (j.status === "completed" && j.storageKey && storageEnabled) {
    try { url = await signedMediaUrl(j.storageKey, { ttlSeconds: SIGNED_TTL_S, contentType: j.contentType ?? "audio/mpeg" }); } catch (err) { console.error("signing an audio link failed", j.id, err); }
  }
  return {
    id: j.id, status: j.status === "completed" ? "completed" : j.status === "failed" ? "failed" : "pending", error: j.error, text: j.text, chars: j.chars, model: j.model,
    modelLabel: findAudioModel(j.model)?.label ?? j.model, voiceId: j.voiceId, voiceName: j.voiceName, createdAt: j.createdAt.toISOString(), durationMs: j.durationMs, contentType: j.contentType, sizeBytes: j.sizeBytes, url, fileName: fileNameOf(j),
  };
}

export type StartAudioInput = { userId: string; text: unknown; model: unknown; voiceId: unknown; voiceName?: unknown; speed?: unknown; projectId?: unknown };
export type StartAudioResult = { ok: true; item: AudioItem } | { ok: false; status: number; error: string };

export async function startAudioJob(input: StartAudioInput): Promise<StartAudioResult> {
  const { userId } = input;
  const cfg = audioSettings();
  if (cfg.paused) return { ok: false, status: 503, error: "Voice generation is paused right now. Please try again later." };
  const model = findAudioModel(input.model);
  if (!model || !model.kinds.includes("tts")) return { ok: false, status: 400, error: "That voice model is not available." };
  const ctx = ctxFor(model);
  if (!ctx) return { ok: false, status: 503, error: "Voice generation is not set up yet." };
  if (!storageEnabled) return { ok: false, status: 503, error: "Audio storage is not set up yet." };

  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (!text) return { ok: false, status: 400, error: "Write the text to speak first." };
  if (text.length > model.maxChars) return { ok: false, status: 400, error: `${model.label} takes up to ${model.maxChars.toLocaleString("en-US")} characters (you wrote ${text.length.toLocaleString("en-US")}).` };
  const voiceId = typeof input.voiceId === "string" ? input.voiceId.trim() : "";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(voiceId)) return { ok: false, status: 400, error: "Pick a voice first." };
  const voiceName = typeof input.voiceName === "string" ? input.voiceName.trim().slice(0, 80) || null : null;
  let speed: number | undefined;
  if (input.speed != null && input.speed !== 1) {
    if (typeof input.speed !== "number" || !Number.isFinite(input.speed) || input.speed < 0.7 || input.speed > 1.2) return { ok: false, status: 400, error: "Speed must be between 0.7 and 1.2." };
    if (!model.supports.speed) return { ok: false, status: 400, error: `${model.label} has no speed control.` };
    speed = Math.round(input.speed * 100) / 100;
  }
  const projectId = typeof input.projectId === "string" && input.projectId.length <= 64 ? input.projectId : null;

  const m = checkPrompt(text);
  if (!m.ok) { console.warn("audio text refused", m.category); return { ok: false, status: 422, error: m.reason }; }

  const cost = audioCreditsOn() ? ttsCredits(model, text.length) : null;
  const running = await db.audioJob.count({ where: { userId, status: "pending" } });
  if (running >= cfg.maxRunning) return { ok: false, status: 429, error: `You already have ${running} voices being made. Wait for one to finish.` };
  if (!(await claimUsage(userId, "audio", cfg.perMinute, 60_000))) return { ok: false, status: 429, error: "You are starting voices very quickly. Wait a moment and try again." };
  if (!(await claimUsage(userId, "audio-day", cfg.perDay, 24 * 3600_000))) return { ok: false, status: 429, error: `You have reached today's limit of ${cfg.perDay} voices.` };

  const made = await createAudioJobHeld(userId, cost, {
    id: randomUUID().replace(/-/g, "").slice(0, 25), userId, projectId, kind: "tts", provider: model.provider, model: model.id, voiceId, voiceName, text, textHash: createHash("sha256").update(text).digest("hex"),
    chars: text.length, status: "pending", creditsHeld: cost, params: speed ? { speed } : undefined,
  });
  if (!("row" in made)) return { ok: false, status: 402, error: `This needs ${cost} credits. You have ${made.have}${made.held ? `, and ${made.held} are held by work still running` : ""}. Ask the owner to add more credits.` };

  waitUntil(runAudioJob(made.row.id).catch((err) => console.error("audio job crashed", made.row.id, err)));
  return { ok: true, item: await toAudioItem(made.row) };
}

// `code` (the normalised provider error code, never the provider's own text) is kept in params for the owner's health page.
async function failJob(id: string, error: string, code?: string, base?: object): Promise<void> {
  await db.audioJob.updateMany({ where: { id, status: "pending" }, data: { status: "failed", error, finishedAt: new Date(), ...(code ? { params: { ...(base ?? {}), failCode: code } } : {}) } });
}

// Runs one job in the background. Claimed atomically (startedAt), so a second run of the same job does nothing.
export async function runAudioJob(id: string): Promise<void> {
  const claim = await db.audioJob.updateMany({ where: { id, status: "pending", startedAt: null }, data: { startedAt: new Date() } });
  if (claim.count === 0) return;
  const job = await db.audioJob.findUnique({ where: { id } });
  if (!job) return;
  const model = findAudioModel(job.model);
  const ctx = model ? ctxFor(model) : null;
  if (!model || !ctx) return failJob(id, "This voice model is not available right now. Nothing was charged.");
  const provider = providerFor(model);
  const speed = (job.params && typeof job.params === "object" && !Array.isArray(job.params) ? (job.params as { speed?: number }).speed : undefined) || undefined;

  let audio: Uint8Array;
  let chunks = 1;
  let characterCost: number | undefined;
  try {
    const pieces = splitForTts(job.text, model.callChars, "char");
    chunks = pieces.length;
    const parts: Uint8Array[] = [];
    for (let i = 0; i < pieces.length; i++) {
      const req: AudioRequest = { kind: "tts", modelId: model.id, text: pieces[i], voiceId: job.voiceId ?? undefined, speed, format: "mp3", previousText: pieces[i - 1]?.slice(-300), nextText: pieces[i + 1]?.slice(0, 300) };
      const release = await limiterFor(model.provider).acquire();
      try {
        const res = await withRetry(() => provider.generate(req, ctx));
        if (!res.bytes?.length) throw new ProviderFailure({ retryable: false, code: "empty_audio", userMessage: "The voice could not be made. Please try again." });
        parts.push(res.bytes);
        if (typeof res.usage?.characterCost === "number") characterCost = (characterCost ?? 0) + res.usage.characterCost;
      } finally { release(); }
    }
    audio = joinMp3(parts);
  } catch (err) {
    if (err instanceof ProviderFailure) {
      if (err.error.alert) console.error("AUDIO ALERT: provider needs the owner", model.provider, err.error.code, err.error.providerCode);
      else console.warn("audio provider failure", model.provider, err.error.code);
      return failJob(id, `${err.error.userMessage} Nothing was charged.`, err.error.code, job.params && typeof job.params === "object" && !Array.isArray(job.params) ? job.params : undefined);
    }
    console.error("audio job failed", id, err);
    return failJob(id, "The voice could not be made. Nothing was charged.");
  }

  const key = `audio/${job.userId}/${job.id}.mp3`;
  try { await putObject(key, audio, "audio/mpeg"); }
  catch (err) { console.error("saving audio failed", id, err); return failJob(id, "The voice was made but could not be saved. Nothing was charged."); }

  // Settle: the price follows the characters actually sent (the provider's own `character-cost` is kept in usage for reconciling, not used to bill: it may count credits, not characters).
  const usd = usdFor(model, job.chars);
  const credits = audioCreditsOn() && job.creditsHeld != null ? creditsFor(usd) : null;
  // Completing the row and writing the charge happen in ONE short transaction under the person's credit lock (the one spendCredits takes): a finished voice is always
  // either charged exactly once or not finished, and a row that was failed meanwhile (stale) is neither kept nor charged.
  const data = { status: "completed", storageKey: key, contentType: "audio/mpeg", sizeBytes: audio.length, durationMs: mp3DurationMs(audio.length), costUsd: usd, creditsCharged: null as number | null, finishedAt: new Date(), usage: { chars: job.chars, chunks, ...(characterCost != null ? { characterCost } : {}) } };
  let completed = false;
  try {
    completed = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${job.userId}))`;
      const fresh = await tx.audioJob.findUnique({ where: { id }, select: { status: true } });
      if (fresh?.status !== "pending") return false;
      let charged: number | null = null;
      if (credits != null) {
        const sum = await tx.creditLedger.aggregate({ where: { userId: job.userId }, _sum: { delta: true } });
        if ((sum._sum.delta ?? 0) >= credits) {
          await tx.creditLedger.create({ data: { userId: job.userId, delta: -credits, reason: "CHARGE", note: `${model.label} voice, ${job.chars} characters` } });
          charged = credits;
        } else console.error("audio price could not be charged: balance too low", id);
      }
      await tx.audioJob.update({ where: { id }, data: { ...data, creditsCharged: charged } });
      return true;
    });
  } catch (err) {
    console.error("completing an audio job failed", id, err);
    await deleteObject(key).catch(() => {});
    return failJob(id, "The voice was made but could not be saved. Nothing was charged.");
  }
  if (!completed) await deleteObject(key).catch(() => {}); // the row was failed (stale) meanwhile: do not keep the file
}

// The poll: also ends a job whose background run died (the price hold is released by the status change; nothing was charged).
export async function getAudioJob(userId: string, id: string): Promise<AudioJob | null> {
  const j = await db.audioJob.findFirst({ where: { id, userId, deletedAt: null } });
  if (!j || j.status !== "pending") return j;
  const age = Date.now() - j.createdAt.getTime();
  const started = j.startedAt ? Date.now() - j.startedAt.getTime() : 0;
  if ((!j.startedAt && age > STALE_NOT_STARTED_MS) || (j.startedAt && started > STALE_RUNNING_MS)) {
    await failJob(j.id, "This voice took too long and was stopped. Nothing was charged.");
    return db.audioJob.findFirst({ where: { id, userId } });
  }
  return j;
}

export async function listAudioJobs(userId: string, limit = 30): Promise<AudioJob[]> {
  return db.audioJob.findMany({ where: { userId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: Math.min(Math.max(limit, 1), 100) });
}

export async function deleteAudioJob(userId: string, id: string): Promise<boolean> {
  const j = await db.audioJob.findFirst({ where: { id, userId } });
  if (!j || j.status === "pending") return false;
  if (j.storageKey && storageEnabled) await deleteObject(j.storageKey).catch((err) => console.error("deleting audio file failed", id, err));
  await db.audioJob.delete({ where: { id } });
  return true;
}

export type { AudioModel };
