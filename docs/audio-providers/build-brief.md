# Build brief (Part 1 of the master brief)

Scope: ADD an audio capability (a new provider interface, registry entries, routes, ledger, storage). Do NOT touch Canvas or Agents (last stage). Greyed-out chips for any option a model does not support. Push in batches; report with the VERIFICATION REPORT format from `docs/engineering-rules.md`.

## 1. Capabilities and which provider serves them
| capability | primary | also |
|---|---|---|
| tts | ElevenLabs `eleven_v4`, Fish `s2.1-pro` | MiniMax `speech-2.8-hd`, Qwen `qwen3-tts-flash`, Seed Audio |
| tts long (over a few thousand chars) | MiniMax async | ElevenLabs/Fish via chunking |
| stt | ElevenLabs `scribe_v2` | Fish `/v1/asr`, MiniMax `asr-1.0` |
| sfx | ElevenLabs `eleven_text_to_sound_v2` | Seed Audio (scene audio) |
| music | ElevenLabs `music_v2_5` (paid plan) | MiniMax music is CLOSED to new users: do not build |
| voice clone | ElevenLabs instant clone, Fish `/model`, MiniMax `voice_clone` | Seed Audio inline references, Qwen later |
| voice design | ElevenLabs `/v1/text-to-voice/design`, MiniMax `voice_design`, Fish `/v1/voice-design` | none |

Build order: 1 provider interface, registry, job table, R2 storage, ledger hooks, ElevenLabs TTS (`eleven_v4`, `eleven_flash_v2_5`) + fake provider for tests. 2 Fish TTS, MiniMax TTS (sync), Qwen `qwen3-tts-flash`, Seed Audio `/tts/create`. 3 STT (ElevenLabs Scribe, Fish ASR, MiniMax ASR). 4 SFX + music (ElevenLabs). 5 Voices: list, clone (with consent), design, delete (Voices table). 6 MiniMax long TTS (async), polish.
Do not build: WebSocket realtime, MiniMax music, ElevenLabs professional clone, dubbing, Qwen-Audio/CosyVoice WebSocket families.

## 2. Provider interface
```ts
type AudioKind = 'tts' | 'stt' | 'sfx' | 'music';
interface AudioProvider {
  id: string;                         // 'elevenlabs' | 'fish' | 'minimax' | 'qwen' | 'seed-audio'
  supports(kind: AudioKind, modelId: string): boolean;
  generate(req: AudioRequest, ctx: ProviderCtx): Promise<AudioResult>;   // sync providers
  start?(req, ctx): Promise<{ providerJobId: string }>;                   // async providers (MiniMax long)
  poll?(providerJobId, ctx): Promise<{ status: 'running'|'done'|'failed'; result?: AudioResult; error?: ProviderError }>;
  listVoices?(ctx, q): Promise<Voice[]>;
  cloneVoice?(input, ctx): Promise<Voice>;
  designVoice?(input, ctx): Promise<VoicePreview[]>;
  deleteVoice?(providerVoiceId, ctx): Promise<void>;
}
type AudioResult = { bytes?: Uint8Array; url?: string; mime: string; durationMs?: number; providerCost?: number; usage?: Record<string, number>; raw?: unknown; subtitles?: unknown };
type ProviderError = { retryable: boolean; code: string; userMessage: string; providerCode?: string|number };
```
Rules:
- Plain `fetch` only. No provider SDKs.
- Every adapter returns bytes or a provider URL; the ORCHESTRATOR (not the adapter) uploads to R2 and creates the signed URL. Never return provider URLs to the browser (they expire: Qwen 24 h, MiniMax 24 h/9 h, Seed 2 h).
- Normalise errors into `ProviderError`. Retryable: HTTP 429 (all providers), 5xx, ElevenLabs `system_busy`/`concurrent_limit_exceeded`, MiniMax codes 1000, 1001, 1002, 1013, 1024, 1033, 1039, 2045, Fish 503. Not retryable, shown to user: content rejected (MiniMax 1026/1027/422, ElevenLabs `bad_prompt`), invalid params. Admin alert (not user message): 401/403/402, ElevenLabs `insufficient_credits`, MiniMax 1008/2038, Fish 402. MiniMax and Seed can return HTTP 200 with an error code in the body: always inspect the body.
- Model IDs and prices live in the model registry (config), not code. Entry: provider, modelId, kinds, languages note, `maxChars`, priceUnit ('char'|'byte'|'second'|'minute'|'hour'|'request'), price, supports flags (`emotionTags`, `speed`, `pitch`, `voiceClone`, `streaming`, `subtitles`), `deprecatedOn`.

Registry entries to seed (verify limits against the files):
- ElevenLabs: `eleven_v4` (10,000 chars, $0.08/1K), `eleven_v4_turbo` (about 100 ms, $0.04/1K), `eleven_v3` (5,000), `eleven_multilingual_v2` (10,000), `eleven_flash_v2_5` (40,000, $0.04/1K), `scribe_v2` ($0.22/h), `eleven_text_to_sound_v2` ($0.12/min; reconcile), `music_v2_5` ($0.15/min).
- Fish: `s2.1-pro` ($15 per 1M UTF-8 bytes, unit 'byte'), `s2.1-pro-free` (free, gated; sunsets 2026-11-30), `drama-3` (price unknown: disabled until the owner supplies it), `s2-pro`, `s1` (deprecated 2026-12-31: do not register). `transcribe-1-pro` ($0.36/h).
- MiniMax: `speech-2.8-hd` ($100/1M chars), `speech-2.8-turbo` ($60/1M), `speech-2.6-hd`, `speech-2.6-turbo`; `asr-1.0` ($0.38/h). maxChars 10,000 sync; 50,000 async.
- Qwen: `qwen3-tts-flash` ($0.10 per 10K chars, maxChars 600), `qwen3-tts-instruct-flash` ($0.115 per 10K, assume 600).
- Seed Audio: `seed-audio-1.0` (billing by `original_duration`, price per second: verify), maxDuration 120 s, text_prompt 3000 chars.

## 3. Jobs, storage, queueing
- Audio generation can take 1 to 40+ s. Use the SAME job pattern as video: `POST /api/audio/generate` validates, reserves credits, inserts a `Generation` row (`status: queued`), returns `{generationId}`; a worker/route with `export const maxDuration = 300` does the provider call; the client polls `GET /api/audio/[id]`. Do not hold the user's request open on the Hobby limit; verify plan max duration; use provider async API or chunking with a queue if a call can exceed it.
- Vercel request bodies are limited to 4.5 MB. Voice samples, STT files and reference clips MUST go straight to R2 with a presigned PUT, then be passed by signed URL or fetched in the worker. Never proxy big files through a route.
- Concurrency: ElevenLabs 2 to 15 by plan; Fish 5/15/50; MiniMax 60 RPM (TTS); Qwen 180 RPM; MiniMax STT 2 concurrent. Per-provider limiter (semaphore + RPM bucket) and retry 429 with exponential backoff and jitter (no provider documents `Retry-After`). Config: `AUDIO_<PROVIDER>_MAX_CONCURRENCY`, `AUDIO_<PROVIDER>_RPM`.
- Chunking: split on sentence boundaries under `maxChars`; ElevenLabs `previous_text`/`next_text`; Qwen max 600 chars per call; concatenate (ffmpeg in a worker, or keep PCM and encode once; MP3 byte concatenation only for constant-rate MP3 and may click: test it).
- Store: `audio/{userId}/{generationId}.{ext}` in R2; keep mime, duration, provider, model, voice id, text hash, cost. Short-expiry signed URLs.

## 4. Credits ledger and cost
- Reserve at start, settle at finish with the provider's real usage (ElevenLabs `character-cost` header, MiniMax `extra_info.usage_characters`, Qwen `usage.characters`, Seed `original_duration`, Fish bytes = `Buffer.byteLength(text,'utf8')`); refund on failure. Credit price = provider cost x margin factor from config, rounded up. One ledger row per call with model, units, provider cost, credits.
- The free Fish model must still charge Eclipse credits or be gated to paid users; config switch to turn it off before 2026-11-30 without a deploy.
- Voice clone/design billed separately (MiniMax $1.50 per clone at first use, $3 per design; Fish design $0.01; ElevenLabs clone not stated). Flat credit amount from config.

## 5. Voices and consent (mandatory)
- Voices table: `id, userId, provider, providerVoiceId, name, kind ('system'|'cloned'|'designed'), language, previewUrl, createdAt, lastUsedAt, expiresAt?`. System voices fetched live and cached; never hard-code voice ids as defaults (ElevenLabs default voices expire 2026-12-31).
- Cloning requires an explicit consent checkbox: "I own this voice or have written permission to clone it." Store the consent record (user, time, text version, sample hash). Block public sharing of cloned voices. Rate-limit clone attempts. Delete the provider voice when the user deletes it.
- MiniMax clones are deleted after 7 days without synthesis: store `lastUsedAt`, warn. Qwen voices expire after 1 year unused. MiniMax cloned/designed voices appear in the list only after first synthesis.
- Moderation: reject impersonation of real public figures if the provider reports a safety violation; show friendly messages for content-rejection codes.

## 6. UI (Voice Studio, within the existing design)
Per model, greyed out when unsupported (registry flags): text box with char counter vs `maxChars`, model chip, voice picker (search, language, preview play), speed, pitch, emotion/style (ElevenLabs/Fish: audio tag helper buttons inserting `[happy]`; not on models without tags; Fish S2 uses `[tag]` never `(tag)`; MiniMax uses `emotion` field and `(laughs)` tags only on 2.8), language chip, format (mp3/wav), subtitles toggle where supported, result player with download. STT: upload or record, transcript with speakers/timestamps. Music: prompt, length (3 to 600 s ElevenLabs), instrumental toggle. SFX: prompt, duration 0.5 to 30 s, loop toggle. Do not claim a language list per model unless the reference file states it.

## 7. Environment variables (names only; the owner sets keys in Vercel; never paste keys in chat)
Secrets: `ELEVENLABS_API_KEY`, `FISH_API_KEY`, `MINIMAX_API_KEY`, `DASHSCOPE_API_KEY` (Singapore/international), `BYTEPLUS_VOICE_API_KEY` (Seed Speech console key, NOT `ARK_API_KEY`).
Config: `MINIMAX_BASE_URL=https://api.minimax.io`, `ELEVENLABS_BASE_URL=https://api.elevenlabs.io`, `FISH_BASE_URL=https://api.fish.audio`, `DASHSCOPE_BASE_URL` (default `https://dashscope-intl.aliyuncs.com`, verify), `DASHSCOPE_REGION=sg`, `BYTEPLUS_VOICE_BASE_URL=https://voice.ap-southeast-1.bytepluses.com/api/v3`, `AUDIO_FISH_FREE_ENABLED` (true until 2026-11-30), per-provider `AUDIO_<PROVIDER>_MAX_CONCURRENCY`, `AUDIO_<PROVIDER>_RPM`. Existing R2 and ledger env vars are reused.

## 8. Tests
- Unit: request builders produce the exact bodies in the reference files (golden JSON per provider); error mapper table (every code in the files); chunker (never mid-sentence, respects maxChars, Fish counts bytes); cost calculators; MiniMax hex decode; Seed `references` mutual exclusion; Fish rejects `(tag)` for S2.
- Integration with a fake provider server (no real keys in CI): sync success, 429 backoff, error-with-HTTP-200, expired URL, partial failure with refund, concurrency limiter.
- Manual smoke list after keys are set (one request each): ElevenLabs TTS, Fish TTS, MiniMax TTS, Qwen TTS, Seed Audio scene, ElevenLabs STT, ElevenLabs SFX, ElevenLabs music.

## 9. Deprecations and risks (put in code comments and the registry)
Fish `s1` retires 2026-12-31; Fish free `s2.1-pro-free` only until 2026-11-30; `drama-3` price unknown. ElevenLabs premade voices expire 2026-12-31; `music_v1` is the API default so always send the model. MiniMax music closed to new users (from 2026-08-20); MiniMax clones deleted after 7 days unused. Qwen lineup is changing: keep ids in the registry. Seed Speech docs partly unverified.

## 10. NOT VERIFIED (ask the owner to test or fetch; do not guess)
ElevenLabs: full `output_format` list, `voice_settings` ranges, PVC REST paths, composition-plan REST path, instant clone file limits. Fish: max text length, language list, `drama-3` price, voice-design to saved-voice flow. MiniMax: WebSocket auth, voice-design voice lifetime, voice-design preview price conflict ($30 vs $60 per 1M). Qwen: official Singapore host for the HTTP call, full voice list, `qwen3-tts-instruct-flash` instruction field name and char limit, `qwen3-tts-vc` enrollment fields, voice management action names. Seed: `/tts/voice_clone`, `get_voice`, ASR paths and bodies, direct BytePlus price, rate limits.
