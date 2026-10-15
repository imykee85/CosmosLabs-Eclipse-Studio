# Seed Audio (BytePlus Seed Speech) reference

BytePlus doc pages did not load for our reader. Facts come from the official OpenAPI spec in the tryAGI SDK, BytePlus ComfyUI PR, Runware, Atlas Cloud and PiAPI docs. VERIFY marked items with a real key.

## 0. KEY WARNING
Seed Speech is a different product from ModelArk. The ModelArk key (`ARK_API_KEY`) does NOT work (401 / `45000010 Invalid X-Api-Key`). Needs its own key from the BytePlus Seed Speech console: Secret `BYTEPLUS_VOICE_API_KEY`. Host `https://voice.ap-southeast-1.bytepluses.com/api/v3` (Config `BYTEPLUS_VOICE_BASE_URL`). Auth header `X-Api-Key: <key>` (NOT Bearer). Optional `X-Api-Request-Id: <uuid>`; response header `X-Tt-Logid` (log it).

## 1. Seed Audio 1.0 `POST /tts/create`
Speech plus sound effects/ambience scenes from a text prompt; up to 120 s per request.
Body: `model` "seed-audio-1.0"; `text_prompt` (max 3000 chars; refer to references as `@Audio1`..`@Audio3`); `references` (max 3: up to 3 audio refs OR 1 image ref, never mixed; each audio ref uses exactly one of `speaker`, `audio_data` base64 (wav/mp3/pcm/ogg_opus; up to 30 s and 10 MB), `audio_url`; image ref `image_data` or `image_url` jpeg/png/webp up to 10 MB); `audio_config {format wav (default)|mp3|pcm|ogg_opus, sample_rate 8000..48000, speech_rate -50..100, loudness_rate -50..100, pitch_rate -12..12, enable_subtitle}`; `watermark {aigc_watermark, aigc_metadata{...}}`.
Response JSON: `code`, `message`, `audio` (base64), `duration`, `original_duration` (billing, max 120), `url` (valid 2 hours), `subtitle {...}`. Persist base64 to R2; do not rely on `url`. Errors HTTP 400/401/429/500; always check body `code` (may be 200 with an error). Synchronous, about 33 s per request: long-timeout route with the job/poll pattern.

## 2. Seed Speech TTS (same host/key)
`POST /tts/unidirectional` (HTTP streaming): models `seed-tts-2.0`, `seed-tts-1.0`, `seed-icl-2.0`, `seed-icl-1.0` (cloned via `custom_speaker_id`). Request/response body NOT READABLE: in v1 use Seed Audio `/tts/create` with `references:[{speaker:"<voice id>"}]` for plain TTS.

## 3. Voice cloning
`POST /tts/voice_clone` then poll `get_voice` (paths and bodies NOT READ; VERIFY). Output `speaker_id` for `seed-icl-2.0` and as a Seed Audio `speaker` reference. Voice slots (`S_...`) purchased in the console. Seed Audio also does zero-shot cloning inline (1 to 3 clips, 30 s, 10 MB) as `references`. Consent: none in docs; Eclipse adds its own.

## 4. STT (Seed ASR): `recognize/flash`, `submit` + `query`: paths/bodies NOT READ; VERIFY. Not in v1.

## 5. Pricing: direct BytePlus price NOT FOUND (billing by `original_duration`). Third parties: Runware $0.00263/s, Atlas Cloud $0.143/min, PiAPI $0.002/s. Config.

## 7. Eclipse notes
Provider id `byteplus-seed-audio`: scene audio/SFX+speech, tts, voice reference. NOT music. Ledger uses `original_duration`. 120 s cap: greyed max-length. Needs the new Seed Speech key (separate from ModelArk).
