// Audio Studio jobs (docs/audio-providers/build-brief.md sections 3 and 4). A job is a row: startAudioJob validates, holds the price and returns at once; the
// provider call runs in the background (waitUntil) and the browser asks GET /api/audio/<id>. The raw provider text never reaches a person: only ProviderError.userMessage.
// Four kinds share one path: tts (speak), stt (transcribe), sfx (sound effects) and music. A long MiniMax text runs on the provider's side and is followed until done.
import { createHash, randomUUID } from "node:crypto";
import { Prisma, type AudioJob } from "@prisma/client";
import { scheduleAutoTopup } from "@/lib/billing";
import { waitUntil } from "@vercel/functions";
import { db } from "@/lib/db";
import { checkPrompt } from "@/lib/moderation";
import { createAudioJobHeld } from "@/lib/reservations";
import { deleteObject, getObjectBytes, headObjectInfo, putObject, signedGetUrl, signedMediaUrl, storageEnabled } from "@/lib/storage";
import { muxEnabled } from "@/lib/sandbox/flags";
import { claimUsage } from "@/lib/usage";
import { joinMp3, joinWav, mp3DurationMs, splitForTts, wavDurationMs } from "./chunk";
import { limiterFor } from "./limiter";
import { audioCreditsOn, creditsFor, estimateSeconds, holdUnitsFor, settledUnits, usdFor } from "./pricing";
import { ctxFor, providerFor } from "./providers";
import { hasParenTag } from "./providers/fish";
import { findAudioModel, musicMaxSeconds, type AudioModel } from "./registry";
import { withRetry } from "./retry";
import { ProviderFailure, type AudioKind, type AudioRequest, type Transcript } from "./types";
import { touchVoice } from "./voices";

const num = (name: string, fallback: number) => (Number(process.env[name]) > 0 ? Math.floor(Number(process.env[name])) : fallback);
export const audioSettings = () => ({
  paused: process.env.AUDIO_KILL_SWITCH === "1",     // set to 1 and every new audio job is refused (running ones finish)
  perMinute: num("AUDIO_JOBS_PER_MINUTE", 10),
  perDay: num("AUDIO_JOBS_PER_DAY", 100),
  maxRunning: num("AUDIO_MAX_RUNNING", 3),
});

const STALE_NOT_STARTED_MS = 2 * 60_000;   // the row exists a moment before the background run begins
const STALE_RUNNING_MS = 8 * 60_000;       // a run that has not finished by now died with its function (300 s limit)
const STALE_ASYNC_MS = 40 * 60_000;        // a long job runs on the provider's side and is followed by polling
const LOCK_STALE_MS = 2 * 60_000;
const SIGNED_TTL_S = 3600;

export type AudioItem = {
  id: string; kind: ItemKind; status: "pending" | "completed" | "failed"; error: string | null; text: string; chars: number; model: string; modelLabel: string;
  voiceId: string | null; voiceName: string | null; createdAt: string; durationMs: number | null; contentType: string | null; sizeBytes: number | null; url: string | null; fileName: string;
  transcript: Transcript | null;
  variants: { url: string | null; durationMs: number | null; contentType: string | null; fileName: string }[] | null; // alternatives (Mirelo); null for a single file
  videoUrl: string | null;                                                                                      // the video a "sound for video" take belongs to
  deletedAt: string | null;                                                                                     // set while the take is in the Bin
  canMux: boolean;                                                                                              // "Download video with sound" is offered (sandbox platform on)
};

const EXT: Record<string, string> = { "audio/mpeg": "mp3", "audio/wav": "wav", "audio/flac": "flac" };
export const fileNameOf = (j: Pick<AudioJob, "id" | "model" | "createdAt" | "contentType">, variant?: number) => {
  const t = j.createdAt.toISOString().replace(/\D/g, "").slice(0, 14);
  return `${j.model.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${t.slice(0, 8)}-${t.slice(8)}-${j.id.slice(-6)}${variant ? `-v${variant}` : ""}.${EXT[j.contentType ?? ""] ?? "mp3"}`;
};

// A job that made several alternatives keeps them in `result.variants` (storage keys); variant 1 is also the job's own storageKey.
type StoredVariant = { key: string; mime: string; sizeBytes: number; durationMs: number | null };
export const variantsOf = (j: Pick<AudioJob, "result">): StoredVariant[] => {
  const v = (asObj(j.result).variants as unknown);
  return Array.isArray(v) ? (v as StoredVariant[]).filter((x) => x && typeof x.key === "string") : [];
};

const asObj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
// "upload": a sound the person added from their device to Assets (no provider made it; it is used as a reference sound or kept in the Library).
export type ItemKind = AudioKind | "upload";
const kindOfJob = (j: Pick<AudioJob, "kind">): AudioKind => (j.kind === "stt" || j.kind === "sfx" || j.kind === "music" || j.kind === "vsfx" ? j.kind : "tts");
const itemKindOf = (j: Pick<AudioJob, "kind">): ItemKind => (j.kind === "upload" ? "upload" : kindOfJob(j));

// A row for the browser: never the raw record (no storage key, provider usage or hashes).
export async function toAudioItem(j: AudioJob): Promise<AudioItem> {
  let url: string | null = null;
  if (j.status === "completed" && j.storageKey && storageEnabled) {
    try { url = await signedMediaUrl(j.storageKey, { ttlSeconds: SIGNED_TTL_S, contentType: j.contentType ?? "audio/mpeg" }); } catch (err) { console.error("signing an audio link failed", j.id, err); }
  }
  const t = asObj(j.result).transcript as Transcript | undefined;
  let variants: AudioItem["variants"] = null;
  const stored = variantsOf(j);
  if (j.status === "completed" && stored.length > 1 && storageEnabled) {
    variants = await Promise.all(stored.map(async (v, i) => ({ url: await signedMediaUrl(v.key, { ttlSeconds: SIGNED_TTL_S, contentType: v.mime }).catch(() => null), durationMs: v.durationMs, contentType: v.mime, fileName: fileNameOf({ ...j, contentType: v.mime }, i + 1) })));
  }
  let videoUrl: string | null = null;
  const videoId = asObj(j.params).videoId;
  if (j.kind === "vsfx" && typeof videoId === "string" && storageEnabled) {
    const g = await db.generation.findFirst({ where: { id: videoId, userId: j.userId, deletedAt: null }, select: { storageKey: true, contentType: true } }).catch(() => null);
    if (g?.storageKey) videoUrl = await signedMediaUrl(g.storageKey, { ttlSeconds: SIGNED_TTL_S, contentType: g.contentType ?? "video/mp4" }).catch(() => null);
  }
  return {
    id: j.id, kind: itemKindOf(j), status: j.status === "completed" ? "completed" : j.status === "failed" ? "failed" : "pending", error: j.error, text: j.text, chars: j.chars, model: j.model,
    modelLabel: j.kind === "upload" ? "Uploaded" : findAudioModel(j.model)?.label ?? j.model, voiceId: j.voiceId, voiceName: j.voiceName, createdAt: j.createdAt.toISOString(), durationMs: j.durationMs, contentType: j.contentType, sizeBytes: j.sizeBytes, url, fileName: fileNameOf(j),
    transcript: t && typeof t.text === "string" ? t : null, variants, videoUrl, deletedAt: j.deletedAt ? j.deletedAt.toISOString() : null, canMux: Boolean(videoUrl) && muxEnabled(),
  };
}

export type StartAudioInput = {
  userId: string; kind?: unknown; text?: unknown; model: unknown; voiceId?: unknown; voiceName?: unknown; speed?: unknown; projectId?: unknown;
  durationSec?: unknown; loop?: unknown; instrumental?: unknown; inputKey?: unknown; inputName?: unknown; diarize?: unknown; language?: unknown;
  videoId?: unknown; variants?: unknown; negativePrompt?: unknown; preserveSpeech?: unknown; format?: unknown; // Mirelo: sound for a video, several alternatives
};
export type StartAudioResult = { ok: true; item: AudioItem } | { ok: false; status: number; error: string };

// Where a recording to transcribe is kept while it is worked on: audio/<user>/in/<name>, put there by the browser through a signed link (see /api/audio/input).
export const inputKeyPattern = (userId: string) => new RegExp(`^audio/${userId.replace(/[^A-Za-z0-9_-]/g, "")}/in/[A-Za-z0-9._-]{1,100}$`);

const cleanName = (v: unknown, fallback: string) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) : "") || fallback;

// ---- Mirelo: sound made for a video, and sound effects with several alternatives (docs/audio-providers/mirelo.md). Every Mirelo job runs on its side and is followed by polling.
// Mirelo bills in ITS credits: USD per credit is a Config value (MIRELO_CREDIT_USD). The default $0.001 follows the partner listing ($0.015 a second at 15 credits a second) and is PROVISIONAL.
const mireloCreditUsd = () => (Number(process.env.MIRELO_CREDIT_USD) > 0 ? Number(process.env.MIRELO_CREDIT_USD) : 0.001);
const OUT_FORMAT = { wav: "wav", mp3: "mp3_192" } as const;
const VSFX_LABEL = "Sound for your video";

async function ownedVideo(userId: string, id: unknown): Promise<{ id: string; storageKey: string; durationSec: number | null; contentType: string | null } | null> {
  if (typeof id !== "string" || !id || id.length > 64) return null;
  const g = await db.generation.findFirst({ where: { id, userId, kind: "video", status: "completed", deletedAt: null, storageKey: { not: null } }, select: { id: true, storageKey: true, durationSec: true, contentType: true } });
  return g?.storageKey ? { id: g.id, storageKey: g.storageKey, durationSec: g.durationSec, contentType: g.contentType } : null;
}

// The request Mirelo receives. For a video the signed link is made NOW (an hour), never stored.
async function mireloRequest(userId: string, kind: AudioKind, model: AudioModel, text: string, params: Record<string, unknown>, idempotencyKey?: string): Promise<AudioRequest> {
  const req: AudioRequest = {
    kind, modelId: model.id, text: kind === "vsfx" ? String(params.prompt ?? "") : text, variants: typeof params.variants === "number" ? params.variants : 1,
    outputFormat: OUT_FORMAT[(params.format === "mp3" ? "mp3" : "wav")], idempotencyKey,
    durationSec: typeof params.durationMs === "number" ? params.durationMs / 1000 : typeof params.durationSec === "number" ? params.durationSec : undefined,
    ...(typeof params.negativePrompt === "string" ? { negativePrompt: params.negativePrompt } : {}), ...(kind === "vsfx" ? { preserveSpeech: params.preserveSpeech !== false } : {}),
  };
  if (kind === "vsfx") {
    const video = await ownedVideo(userId, params.videoId);
    if (!video) throw new ProviderFailure({ retryable: false, code: "video_unavailable", userMessage: "That video is no longer available." });
    req.videoUrl = await signedMediaUrl(video.storageKey, { ttlSeconds: 3600, contentType: video.contentType ?? "video/mp4" });
  }
  return req;
}

// The provider's own quote, in ITS credits. null = it could not say (the registry price is used); { fail } = the owner must act, so the person is told it is not set up.
async function quoteFor(model: AudioModel, ctx: NonNullable<ReturnType<typeof ctxFor>>, req: AudioRequest): Promise<{ credits: number | null } | { fail: string }> {
  const p = providerFor(model);
  if (!p.preflight) return { credits: null };
  try { const q = await withRetry(() => p.preflight!(req, ctx), { tries: 2 }); return { credits: q.credits }; }
  catch (err) {
    if (err instanceof ProviderFailure && err.error.alert) { console.error("AUDIO ALERT: provider needs the owner", model.provider, err.error.code); return { fail: "This is not set up yet." }; }
    console.warn("audio quote failed; using the registry price", err instanceof ProviderFailure ? err.error.code : err);
    return { credits: null };
  }
}

export async function startAudioJob(input: StartAudioInput): Promise<StartAudioResult>;
export async function startAudioJob(input: StartAudioInput, opts: { dryRun: true }): Promise<{ ok: true; quote: number | null } | { ok: false; status: number; error: string }>;
export async function startAudioJob(input: StartAudioInput, opts?: { dryRun?: boolean }): Promise<StartAudioResult | { ok: true; quote: number | null }> {
  const { userId } = input;
  const cfg = audioSettings();
  if (cfg.paused) return { ok: false, status: 503, error: "Audio generation is paused right now. Please try again later." };
  const kind: AudioKind = input.kind === "stt" || input.kind === "sfx" || input.kind === "music" || input.kind === "vsfx" ? input.kind : "tts";
  const model = findAudioModel(input.model);
  if (!model || !model.kinds.includes(kind)) return { ok: false, status: 400, error: "That model is not available." };
  const ctx = ctxFor(model);
  if (!ctx) return { ok: false, status: 503, error: "This is not set up yet." };
  if (!storageEnabled) return { ok: false, status: 503, error: "Audio storage is not set up yet." };

  let text = typeof input.text === "string" ? input.text.trim() : "";
  let voiceId = "";
  let voiceName: string | null = null;
  const params: Record<string, unknown> = {};
  let durationSec: number | undefined;
  let inputBytes = 0;

  if (kind === "tts") {
    if (!text) return { ok: false, status: 400, error: "Write the text to speak first." };
    voiceId = typeof input.voiceId === "string" ? input.voiceId.trim() : "";
    if (voiceId ? !/^[A-Za-z0-9_.-]{1,128}$/.test(voiceId) : !model.voiceOptional) return { ok: false, status: 400, error: "Pick a voice first." };
    if (model.provider === "fish" && hasParenTag(text)) return { ok: false, status: 400, error: "Fish models read cues in square brackets, like [happy], not round ones." };
    voiceName = typeof input.voiceName === "string" ? input.voiceName.trim().slice(0, 80) || null : null;
    if (input.speed != null && input.speed !== 1) {
      if (typeof input.speed !== "number" || !Number.isFinite(input.speed) || input.speed < 0.7 || input.speed > 1.2) return { ok: false, status: 400, error: "Speed must be between 0.7 and 1.2." };
      if (!model.supports.speed) return { ok: false, status: 400, error: `${model.label} has no speed control.` };
      params.speed = Math.round(input.speed * 100) / 100;
    }
  } else if (kind === "vsfx") {
    if (!model.videoInput) return { ok: false, status: 400, error: `${model.label} cannot add sound to a video.` };
    const video = await ownedVideo(userId, input.videoId);
    if (!video) return { ok: false, status: 404, error: "Choose one of your finished videos." };
    const hi = model.maxSeconds ?? 600;
    if (video.durationSec != null) {
      if (video.durationSec > hi) return { ok: false, status: 400, error: `${model.label} takes videos up to ${Math.round(hi / 60)} minutes.` };
      durationSec = Math.max(1, Math.round(video.durationSec * 10) / 10);
      params.durationMs = Math.round(durationSec * 1000);
    }
    params.videoId = video.id; params.prompt = text;
    if (!text) text = VSFX_LABEL;
  } else if (kind === "sfx" || kind === "music") {
    if (!text) return { ok: false, status: 400, error: kind === "sfx" ? "Describe the sound first." : "Describe the music first." };
    const lo = model.minSeconds ?? 0.5, hi = kind === "music" ? musicMaxSeconds(model) : model.maxSeconds ?? 30;
    if (input.durationSec != null) {
      if (typeof input.durationSec !== "number" || !Number.isFinite(input.durationSec) || input.durationSec < lo || input.durationSec > hi) return { ok: false, status: 400, error: `Length must be between ${lo} and ${hi} seconds.` };
      durationSec = Math.round(input.durationSec * 10) / 10;
    } else if (kind === "music") durationSec = 60;
    else if (model.durationRequired) durationSec = 5;
    if (durationSec != null) params.durationSec = durationSec;
    if (kind === "sfx" && input.loop === true) { if (!model.loop) return { ok: false, status: 400, error: `${model.label} cannot make loops.` }; params.loop = true; }
    if (kind === "music" && input.instrumental === true) { if (!model.instrumental) return { ok: false, status: 400, error: `${model.label} cannot leave vocals out.` }; params.instrumental = true; }
  } else {
    const key = typeof input.inputKey === "string" ? input.inputKey : "";
    if (!inputKeyPattern(userId).test(key)) return { ok: false, status: 400, error: "Add a recording first." };
    const info = await headObjectInfo(key);
    if (!info || info.size < 1000) return { ok: false, status: 400, error: "That recording did not finish uploading. Please add it again." };
    if (model.maxInputBytes && info.size > model.maxInputBytes) {
      await deleteObject(key).catch(() => {});
      return { ok: false, status: 413, error: `${model.label} takes recordings up to ${Math.round(model.maxInputBytes / 1048576)} MB (you added ${(info.size / 1048576).toFixed(1)} MB).` };
    }
    inputBytes = info.size;
    text = cleanName(input.inputName, "Recording");
    params.inputKey = key; params.inputName = text; params.inputBytes = info.size; params.inputMime = info.contentType ?? "audio/mpeg";
    if (input.diarize === true) { if (!model.diarize) return { ok: false, status: 400, error: `${model.label} cannot tell speakers apart.` }; params.diarize = true; }
    if (typeof input.language === "string" && /^[A-Za-z]{2,3}(-[A-Za-z]{2,4})?$/.test(input.language.trim())) params.language = input.language.trim();
  }
  if (model.maxVariants && (kind === "sfx" || kind === "vsfx")) {
    const v = input.variants == null ? 1 : Number(input.variants);
    if (!Number.isInteger(v) || v < 1 || v > model.maxVariants) return { ok: false, status: 400, error: `Choose 1 to ${model.maxVariants} variants.` };
    params.variants = v;
    const fmt = input.format == null ? model.formats?.[0] : input.format;
    if (typeof fmt !== "string" || !model.formats?.includes(fmt)) return { ok: false, status: 400, error: "That file format is not offered." };
    params.format = fmt;
    if (kind === "sfx" && typeof input.negativePrompt === "string" && input.negativePrompt.trim()) {
      if (!model.negativePrompt) return { ok: false, status: 400, error: `${model.label} has no "leave out" field.` };
      if (input.negativePrompt.trim().length > 1000) return { ok: false, status: 400, error: "What to leave out can be up to 1,000 characters." };
      const n = checkPrompt(input.negativePrompt);
      if (!n.ok) return { ok: false, status: 422, error: n.reason };
      params.negativePrompt = input.negativePrompt.trim();
    }
    if (kind === "vsfx") params.preserveSpeech = input.preserveSpeech !== false;
  }
  if (kind !== "stt") {
    if (text.length > model.maxChars) return { ok: false, status: 400, error: `${model.label} takes up to ${model.maxChars.toLocaleString("en-US")} characters (you wrote ${text.length.toLocaleString("en-US")}).` };
    const m = checkPrompt(text);
    if (!m.ok) { console.warn("audio text refused", m.category); return { ok: false, status: 422, error: m.reason }; }
  }
  const projectId = typeof input.projectId === "string" && input.projectId.length <= 64 ? input.projectId : null;

  let cost = audioCreditsOn() ? creditsFor(usdFor(model, holdUnitsFor(model, { text, durationSec, inputBytes, variants: typeof params.variants === "number" ? params.variants : undefined }))) : null;
  // Mirelo: ask the provider for its own price first (no charge); it also tells us early when a video cannot be used.
  if (cost != null && model.asyncAlways) {
    try {
      const q = await quoteFor(model, ctx, await mireloRequest(userId, kind, model, text, params));
      if ("fail" in q) return { ok: false, status: 503, error: q.fail };
      if (q.credits != null && q.credits > 0) cost = creditsFor(q.credits * mireloCreditUsd());
    } catch (err) { if (err instanceof ProviderFailure) return { ok: false, status: 400, error: err.error.userMessage }; throw err; }
  }
  if (opts?.dryRun) return { ok: true, quote: cost };
  const release = async () => { if (typeof params.inputKey === "string") await deleteObject(params.inputKey).catch(() => {}); };
  const running = await db.audioJob.count({ where: { userId, status: "pending" } });
  if (running >= cfg.maxRunning) { await release(); return { ok: false, status: 429, error: `You already have ${running} jobs running. Wait for one to finish.` }; }
  if (!(await claimUsage(userId, "audio", cfg.perMinute, 60_000))) { await release(); return { ok: false, status: 429, error: "You are starting jobs very quickly. Wait a moment and try again." }; }
  if (!(await claimUsage(userId, "audio-day", cfg.perDay, 24 * 3600_000))) { await release(); return { ok: false, status: 429, error: `You have reached today's limit of ${cfg.perDay} jobs.` }; }

  const made = await createAudioJobHeld(userId, cost, {
    id: randomUUID().replace(/-/g, "").slice(0, 25), userId, projectId, kind, provider: model.provider, model: model.id, voiceId: voiceId || null, voiceName: voiceId ? voiceName : null, text, textHash: createHash("sha256").update(text).digest("hex"),
    chars: text.length, status: "pending", creditsHeld: cost, params: Object.keys(params).length ? (params as Prisma.InputJsonValue) : undefined,
  });
  if (!("row" in made)) { await release(); return { ok: false, status: 402, error: `This needs ${cost} credits. You have ${made.have}${made.held ? `, and ${made.held} are held by work still running` : ""}. Ask the owner to add more credits.` }; }

  if (voiceId) void touchVoice(userId, model.provider, voiceId); // keeps the "last used" date of the person's own voices (MiniMax deletes unused clones)
  waitUntil(runAudioJob(made.row.id).catch((err) => console.error("audio job crashed", made.row.id, err)));
  return { ok: true, item: await toAudioItem(made.row) };
}

// `code` (the normalised provider error code, never the provider's own text) is kept in params for the owner's health page. A recording still in storage goes with the job.
async function failJob(id: string, error: string, code?: string, base?: object): Promise<void> {
  const row = await db.audioJob.findUnique({ where: { id }, select: { params: true, status: true } });
  const inputKey = asObj(row?.params).inputKey;
  await db.audioJob.updateMany({ where: { id, status: "pending" }, data: { status: "failed", error, finishedAt: new Date(), lockedAt: null, ...(code ? { params: { ...(base ?? asObj(row?.params)), failCode: code } as Prisma.InputJsonValue } : {}) } });
  if (row?.status === "pending" && typeof inputKey === "string") await deleteObject(inputKey).catch(() => {});
}

type Produced = { audio?: Uint8Array; mime: string; durationMs?: number | null; units: number; usage: Record<string, unknown>; transcript?: Transcript; usd?: number; variants?: { audio: Uint8Array; mime: string; durationMs?: number | null }[] };

// Settles one finished job: the file is stored, the row completed and the price charged in ONE short transaction under the person's credit lock (the one spendCredits takes):
// a finished job is always either charged exactly once or not finished, and a row that was failed meanwhile (stale) is neither kept nor charged.
async function completeJob(job: AudioJob, model: AudioModel, p: Produced): Promise<void> {
  const id = job.id;
  let key: string | null = null;
  const savedKeys: string[] = [];
  let stored: StoredVariant[] | null = null;
  if (p.variants?.length) {
    // Several alternatives: audio/<user>/<job>/variant-<n>.<ext>; the first is also the job's own file.
    try {
      stored = [];
      for (let n = 0; n < p.variants.length; n++) {
        const v = p.variants[n];
        const k = `audio/${job.userId}/${job.id}/variant-${n + 1}.${EXT[v.mime] ?? "mp3"}`;
        await putObject(k, v.audio, v.mime);
        savedKeys.push(k);
        stored.push({ key: k, mime: v.mime, sizeBytes: v.audio.length, durationMs: v.durationMs ?? null });
      }
      key = savedKeys[0];
    } catch (err) {
      console.error("saving audio failed", id, err);
      for (const k of savedKeys) await deleteObject(k).catch(() => {});
      return failJob(id, "It was made but could not be saved. Nothing was charged.");
    }
  } else if (p.audio) {
    key = `audio/${job.userId}/${job.id}.${EXT[p.mime] ?? "mp3"}`;
    try { await putObject(key, p.audio, p.mime); }
    catch (err) { console.error("saving audio failed", id, err); return failJob(id, "It was made but could not be saved. Nothing was charged."); }
    savedKeys.push(key);
  }
  const usd = p.usd ?? usdFor(model, p.units);
  const credits = audioCreditsOn() && job.creditsHeld != null ? creditsFor(usd) : null;
  const data = {
    status: "completed", storageKey: key, contentType: key ? p.mime : null, sizeBytes: stored?.[0]?.sizeBytes ?? p.audio?.length ?? null, durationMs: p.durationMs ?? null, costUsd: usd, finishedAt: new Date(), lockedAt: null,
    usage: { chars: job.chars, units: p.units, ...p.usage } as Prisma.InputJsonValue,
    ...(p.transcript ? { result: { transcript: p.transcript } as unknown as Prisma.InputJsonValue } : stored ? { result: { variants: stored } as unknown as Prisma.InputJsonValue } : {}),
  };
  const what = job.kind === "stt" ? `${model.label} transcript, ${Math.round(p.units)} s` : job.kind === "sfx" || job.kind === "music" || job.kind === "vsfx" ? `${model.label}, ${Math.round(p.units)} s` : `${model.label} voice, ${model.priceUnit === "second" ? `${Math.round(p.units)} s` : `${job.chars} characters`}`;
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
          await tx.creditLedger.create({ data: { userId: job.userId, delta: -credits, reason: "CHARGE", note: what } });
          charged = credits;
        } else console.error("audio price could not be charged: balance too low", id);
      }
      await tx.audioJob.update({ where: { id }, data: { ...data, creditsCharged: charged } });
      return true;
    });
  } catch (err) {
    console.error("completing an audio job failed", id, err);
    for (const k of savedKeys) await deleteObject(k).catch(() => {});
    return failJob(id, "It was made but could not be saved. Nothing was charged.");
  }
  if (!completed) for (const k of savedKeys) await deleteObject(k).catch(() => {}); // the row was failed (stale) meanwhile: do not keep the files
  else if (credits != null) scheduleAutoTopup(job.userId);
  const inputKey = asObj(job.params).inputKey;
  if (typeof inputKey === "string") await deleteObject(inputKey).catch(() => {}); // the recording is not kept once it is transcribed
}

function describeFailure(id: string, model: AudioModel, err: unknown, params: unknown): Promise<void> {
  if (err instanceof ProviderFailure) {
    if (err.error.alert) console.error("AUDIO ALERT: provider needs the owner", model.provider, err.error.code, err.error.providerCode);
    else console.warn("audio provider failure", model.provider, err.error.code);
    return failJob(id, `${err.error.userMessage} Nothing was charged.`, err.error.code, asObj(params));
  }
  console.error("audio job failed", id, err);
  return failJob(id, "That could not be made. Nothing was charged.");
}

// Runs one job in the background. Claimed atomically (startedAt), so a second run of the same job does nothing.
export async function runAudioJob(id: string): Promise<void> {
  const claim = await db.audioJob.updateMany({ where: { id, status: "pending", startedAt: null }, data: { startedAt: new Date() } });
  if (claim.count === 0) return;
  const job = await db.audioJob.findUnique({ where: { id } });
  if (!job) return;
  const model = findAudioModel(job.model);
  const ctx = model ? ctxFor(model) : null;
  if (!model || !ctx) return failJob(id, "This model is not available right now. Nothing was charged.");
  const provider = providerFor(model);
  const params = asObj(job.params);
  const kind = kindOfJob(job);
  const call = async (req: AudioRequest) => {
    const release = await limiterFor(model.provider).acquire();
    try {
      const res = await withRetry(() => provider.generate(req, ctx));
      if (kind !== "stt" && !res.bytes?.length) throw new ProviderFailure({ retryable: false, code: "empty_audio", userMessage: "It could not be made. Please try again." });
      return res;
    } finally { release(); }
  };

  try {
    // Mirelo: start the job on its side (idempotent: the same key and body on a retry returns the original job), remember where to follow it, and look at it once now
    // (a short sound is often finished inside the 25 seconds the create waits).
    if (model.asyncAlways && provider.start && provider.poll && (kind === "sfx" || kind === "vsfx")) {
      const req = await mireloRequest(job.userId, kind, model, job.text, params, job.id);
      const release = await limiterFor(model.provider).acquire();
      let started: { taskId: string; pollUrl?: string };
      try { started = await withRetry(() => provider.start!(req, ctx)); } finally { release(); }
      await db.audioJob.update({ where: { id }, data: { params: { ...params, task: { id: started.taskId, ...(started.pollUrl ? { pollUrl: started.pollUrl } : {}) } } as Prisma.InputJsonValue } });
      const fresh = await db.audioJob.findUnique({ where: { id } });
      if (fresh) await advanceAsyncJob(fresh);
      return;
    }
    if (kind === "stt") {
      const key = String(params.inputKey);
      const name = String(params.inputName ?? "recording");
      const mime = String(params.inputMime ?? "audio/mpeg");
      const input: AudioRequest["input"] = { url: await signedGetUrl(key, 3600), name, mime, bytes: () => getObjectBytes(key, model.maxInputBytes ?? 50 * 1048576) };
      const res = await call({ kind, modelId: model.id, text: "", input, diarize: params.diarize === true, language: typeof params.language === "string" ? params.language : undefined });
      const t = res.transcript!;
      const secs = t.durationSec && t.durationSec > 0 ? t.durationSec : estimateSeconds(Number(params.inputBytes) || 0);
      return await completeJob(job, model, { mime: "text/plain", units: secs, usage: { inputBytes: params.inputBytes }, transcript: t, durationMs: Math.round(secs * 1000) });
    }

    if (kind === "sfx" || kind === "music") {
      const requested = typeof params.durationSec === "number" ? params.durationSec : undefined;
      const res = await call({ kind, modelId: model.id, text: job.text, durationSec: requested, loop: params.loop === true, instrumental: params.instrumental === true });
      const ms = mp3DurationMs(res.bytes!.length);
      // Billed on the clip length asked for (music is billed by length); for a sound the model sized itself, on the measured length.
      return await completeJob(job, model, { audio: res.bytes!, mime: res.mime, durationMs: ms, units: requested ?? Math.max(model.minSeconds ?? 0.5, ms / 1000), usage: {} });
    }

    const speed = typeof params.speed === "number" ? params.speed : undefined;
    // A long text on a model that can run it on the provider's side (MiniMax): start it, remember the task, and let the polls follow it.
    if (model.asyncAbove && job.text.length > model.asyncAbove && provider.start && provider.poll) {
      const release = await limiterFor(model.provider).acquire();
      let taskId: string;
      try { taskId = (await withRetry(() => provider.start!({ kind: "tts", modelId: model.id, text: job.text, voiceId: job.voiceId ?? undefined, speed, format: "mp3" }, ctx))).taskId; }
      finally { release(); }
      await db.audioJob.update({ where: { id }, data: { params: { ...params, task: { id: taskId } } as Prisma.InputJsonValue } });
      return;
    }

    const pieces = splitForTts(job.text, model.callChars, model.callUnit ?? "char");
    const parts: Uint8Array[] = [];
    let mime = "audio/mpeg", characterCost: number | undefined, seconds: number | undefined, reportedMs: number | undefined = 0;
    for (let i = 0; i < pieces.length; i++) {
      const res = await call({ kind: "tts", modelId: model.id, text: pieces[i], voiceId: job.voiceId ?? undefined, speed, format: "mp3", previousText: pieces[i - 1]?.slice(-300), nextText: pieces[i + 1]?.slice(0, 300) });
      parts.push(res.bytes!);
      mime = res.mime;
      if (typeof res.usage?.characterCost === "number") characterCost = (characterCost ?? 0) + res.usage.characterCost;
      if (typeof res.usage?.seconds === "number") seconds = (seconds ?? 0) + res.usage.seconds;
      reportedMs = reportedMs != null && res.durationMs != null ? reportedMs + res.durationMs : undefined;
    }
    const audio = mime === "audio/wav" ? joinWav(parts) : joinMp3(parts);
    // The price follows the characters (or UTF-8 bytes) actually sent, or the seconds the provider reports for a second-priced model. A provider's own counters are kept
    // in usage for reconciling, not used to bill (ElevenLabs `character-cost` may count credits, not characters).
    const units = settledUnits(model, job.text, seconds);
    await completeJob(job, model, { audio, mime, durationMs: mime === "audio/wav" ? wavDurationMs(audio) : reportedMs || mp3DurationMs(audio.length), units, usage: { chunks: pieces.length, ...(characterCost != null ? { characterCost } : {}), ...(seconds != null ? { seconds } : {}) } });
  } catch (err) {
    const inputKey = params.inputKey;
    await describeFailure(id, model, err, job.params);
    if (typeof inputKey === "string") await deleteObject(inputKey).catch(() => {});
  }
}

// One step of a long job that runs on the provider's side: a single worker at a time (lockedAt), ask the provider, finish when it is done.
async function advanceAsyncJob(job: AudioJob): Promise<void> {
  const task = asObj(asObj(job.params).task);
  if (typeof task.id !== "string") return;
  const lock = await db.audioJob.updateMany({ where: { id: job.id, status: "pending", OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(Date.now() - LOCK_STALE_MS) } }] }, data: { lockedAt: new Date() } });
  if (lock.count === 0) return;
  const model = findAudioModel(job.model);
  const ctx = model ? ctxFor(model) : null;
  try {
    if (!model || !ctx) return void (await failJob(job.id, "This model is not available right now. Nothing was charged."));
    const provider = providerFor(model);
    const r = await provider.poll!(task.id, ctx, typeof task.pollUrl === "string" ? task.pollUrl : undefined);
    if (r.status === "running") return;
    if (r.status === "failed") return void (await failJob(job.id, r.error?.userMessage ?? "That could not be made. Nothing was charged.", r.error?.code));
    const variants = r.result?.variants;
    if (variants?.length) {
      // Billed per second per variant that SUCCEEDED, from Mirelo's own credits when it reports them (a failed variant is not charged).
      const params = asObj(job.params);
      const seconds = typeof params.durationMs === "number" ? params.durationMs / 1000 : typeof params.durationSec === "number" ? params.durationSec : 30;
      const credits = r.result?.usage?.credits;
      const withMs = variants.map((v) => ({ audio: v.bytes, mime: v.mime, durationMs: v.mime === "audio/wav" ? wavDurationMs(v.bytes) : params.durationMs != null ? Number(params.durationMs) : mp3DurationMs(v.bytes.length) }));
      return await completeJob(job, model, { variants: withMs, mime: withMs[0].mime, durationMs: withMs[0].durationMs, units: seconds * variants.length, ...(typeof credits === "number" ? { usd: credits * mireloCreditUsd() } : {}), usage: { ...r.result?.usage, async: true } });
    }
    const audio = r.result?.bytes;
    if (!audio?.length) return void (await failJob(job.id, "That could not be made. Nothing was charged.", "empty_audio"));
    await completeJob(job, model, { audio, mime: r.result!.mime, durationMs: mp3DurationMs(audio.length), units: settledUnits(model, job.text), usage: { async: true } });
  } catch (err) {
    if (err instanceof ProviderFailure && err.error.retryable) { console.warn("audio poll will retry", err.error.code); return; } // the next poll asks again
    if (model) await describeFailure(job.id, model, err, job.params); else await failJob(job.id, "That could not be made. Nothing was charged.");
  } finally {
    await db.audioJob.updateMany({ where: { id: job.id, status: "pending" }, data: { lockedAt: null } }).catch(() => {});
  }
}

// The poll: also ends a job whose background run died (the price hold is released by the status change; nothing was charged), and moves a long job on.
export async function getAudioJob(userId: string, id: string): Promise<AudioJob | null> {
  let j = await db.audioJob.findFirst({ where: { id, userId, deletedAt: null } });
  if (!j || j.status !== "pending") return j;
  const age = Date.now() - j.createdAt.getTime();
  const started = j.startedAt ? Date.now() - j.startedAt.getTime() : 0;
  const isAsync = typeof asObj(asObj(j.params).task).id === "string";
  if ((!j.startedAt && age > STALE_NOT_STARTED_MS) || (j.startedAt && started > (isAsync ? STALE_ASYNC_MS : STALE_RUNNING_MS))) {
    await failJob(j.id, "This took too long and was stopped. Nothing was charged.");
    return db.audioJob.findFirst({ where: { id, userId } });
  }
  if (isAsync) { await advanceAsyncJob(j); j = (await db.audioJob.findFirst({ where: { id, userId, deletedAt: null } })) ?? j; }
  return j;
}

// `only`: just that kind (Assets lists "upload"); `without`: leave a kind out (Audio Studio lists what it made, not uploads).
export async function listAudioJobs(userId: string, limit = 30, filter: { only?: string; without?: string } = {}): Promise<AudioJob[]> {
  const kind = filter.only ? { kind: filter.only } : filter.without ? { kind: { not: filter.without } } : {};
  const rows = await db.audioJob.findMany({ where: { userId, deletedAt: null, ...kind }, orderBy: { createdAt: "desc" }, take: Math.min(Math.max(limit, 1), 100) });
  // The browser asks this list every 2 seconds while anything is pending: that is what moves a long job on (a few at a time).
  const longOnes = rows.filter((r) => r.status === "pending" && typeof asObj(asObj(r.params).task).id === "string").slice(0, 3);
  if (!longOnes.length) return rows;
  await Promise.all(longOnes.map((r) => getAudioJob(userId, r.id).catch((err) => console.error("advancing a long job failed", r.id, err))));
  return db.audioJob.findMany({ where: { userId, deletedAt: null, ...kind }, orderBy: { createdAt: "desc" }, take: Math.min(Math.max(limit, 1), 100) });
}

// Delete moves a finished take to the Bin (it can be restored); a failed take has no file worth keeping and goes at once. `forever` removes the file and the row, and only works
// on a take that is already in the Bin (or failed).
export async function deleteAudioJob(userId: string, id: string, forever = false): Promise<boolean> {
  const j = await db.audioJob.findFirst({ where: { id, userId } });
  if (!j || j.status === "pending") return false;
  if (!forever && j.status !== "failed") {
    if (!j.deletedAt) await db.audioJob.update({ where: { id }, data: { deletedAt: new Date() } });
    return true;
  }
  if (forever && !j.deletedAt && j.status !== "failed") return false;
  if (storageEnabled) for (const k of new Set([...(j.storageKey ? [j.storageKey] : []), ...variantsOf(j).map((v) => v.key)])) await deleteObject(k).catch((err) => console.error("deleting audio file failed", id, err));
  await db.audioJob.delete({ where: { id } });
  return true;
}

export async function restoreAudioJob(userId: string, id: string): Promise<boolean> {
  const r = await db.audioJob.updateMany({ where: { id, userId, deletedAt: { not: null } }, data: { deletedAt: null } });
  return r.count > 0;
}

export function listBinnedAudio(userId: string, limit = 100): Promise<AudioJob[]> {
  return db.audioJob.findMany({ where: { userId, deletedAt: { not: null } }, orderBy: { deletedAt: "desc" }, take: Math.min(Math.max(limit, 1), 100) });
}

export type { AudioModel };
