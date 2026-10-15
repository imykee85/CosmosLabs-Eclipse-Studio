# ElevenLabs reference (NOT STATED = docs did not say; test it)

## 1. Basics
- Base URL `https://api.elevenlabs.io`. Auth header `xi-api-key: <ELEVENLABS_API_KEY>` (Secret). Keys can be restricted by scope, credit quota and IP allowlist (blocked IP = 403). Never expose the key to the browser.
- Plain `fetch`, no SDK. Response headers on generation: `character-cost`, `request-id` (also `x-trace-id`); music returns `song-id`. Log them in the ledger.
- Errors: JSON `{detail: {...}}` with `code`. 400 validation_error/invalid_request (`text_too_long`, `invalid_voice_id`, `unsupported_model`, `invalid_output_format`), 401 authentication_error, 402 `insufficient_credits`, 403 authorization_error (`feature_not_available`, `subscription_required`, `voice_access_denied`, `model_access_denied`), 404 not_found (`voice_not_found`), 409 conflict, 422 validation, 429 `rate_limit_exceeded` | `concurrent_limit_exceeded` | `system_busy` (back off exponentially; no `Retry-After`), 500 internal_error, 503 `service_unavailable` | `maintenance`. Branch on `code`.
- Concurrency by plan (simultaneous): Free multilingual-v2 2 / flash 4 / STT 8 / music 0; Starter 3 / 6 / 12 / music 2; Creator 5 / 10 / 20 / 2; Pro 10 / 20 / 40 / 2; Scale and Business 15 / 30 / 60 / 5.

## 2. Models
TTS (`model_id`): `eleven_v4` (flagship, 90+ languages, 10,000 chars, multi-speaker, audio tags), `eleven_v4_turbo` (about 100 ms, 90+ languages, audio tags), `eleven_v3` (70+ languages, 5,000 chars), `eleven_v3_conversational` (about 280 ms), `eleven_multilingual_v2` (29 languages, 10,000 chars, most stable for long form; API default), `eleven_flash_v2_5` (about 75 ms, 32 languages, 40,000 chars, 50 percent lower price), `eleven_flash_v2` (English only, 30,000 chars). Legacy: `eleven_turbo_v2_5`, `eleven_turbo_v2`, v1.
Speech to speech: `eleven_multilingual_sts_v2`, `eleven_english_sts_v2`. STT: `scribe_v2` (batch), `scribe_v2_realtime`, `scribe_v2_medical`; `scribe_v1` deprecated. SFX: `eleven_text_to_sound_v2`. Music: `music_v1` (API default), `music_v2`, `music_v2_5`. Voice design: `eleven_multilingual_ttv_v2` (default), `eleven_ttv_v3`.
Premade voices expire 2026-12-31: never hard-code premade ids as defaults; list with the voices endpoint.

## 3. Pricing (USD, API)
TTS per 1,000 chars: v4 $0.08, v4 Turbo $0.04, v3 $0.08, v3 Conversational $0.04, Multilingual v2 $0.08, Flash/Turbo $0.04. STT per hour: Scribe v2 $0.22 (+$0.05 keyterms, +$0.07 transcript editing), Realtime $0.39. Music $0.15 per minute. SFX $0.12 per minute (the page also says 40 credits per second when duration is set; reconcile by measuring). Voice cloning price NOT STATED. Plans: Starter $6, Creator $22, Pro $99, Scale $299, Business $990 per month. Prices are config.
Plan gates: MP3 192 kbps needs Creator+, PCM/WAV 44.1 kHz Pro+, Professional Voice Cloning Creator+, Music API needs a paid plan, commercial use needs a paid plan, community Voice Library voices not available via API on free tier, zero-retention enterprise only.

## 4. Text to speech
`POST /v1/text-to-speech/{voice_id}` (whole file) and `POST /v1/text-to-speech/{voice_id}/stream`. Same body.
Query: `output_format` (default `mp3_44100_128`, format `codec_sample_rate_bitrate`; examples `mp3_44100_128`, `mp3_22050_32`, `ulaw_*`, `pcm_*`, `opus`; the full list was collapsed on the page: confirm via OpenAPI), `enable_logging` (default true), `optimize_streaming_latency` (DEPRECATED, do not use).
Body: `text` (required), `model_id`, `language_code` (ISO 639-1; not for multilingual_v2), `voice_settings` `{stability, similarity_boost, style, use_speaker_boost, speed}` (stability 0.0 to 1.0, speed default 1.0 with 0.7 to 1.2 supported), `pronunciation_dictionary_locators` `[{id, version_id}]` (max 3), `seed` (0 to 4294967295), `previous_text` / `next_text`, `previous_request_ids` / `next_request_ids` (max 3), `apply_text_normalization` auto|on|off, `apply_language_text_normalization` (Japanese only), `use_pvc_as_ivc`, `audio_effects`.
Response audio bytes; 422 on validation error.
Chunking: split under the model limit, send `previous_text`/`next_text` or request ids for smooth prosody.
Prompting: v4/v3 use audio tags in brackets: `[whispers]`, `[laughs]`, `[sighs]`, `[excited]`, `[sarcastic]`, `[crying]`, sound tags `[applause]`, `[gunshot]`, `[explosion]`, experimental `[strong French accent]`. SSML `<break>` NOT supported on v4/v3 (use ellipses, dashes, capitals); other models support `<break time="1.5s" />` up to 3 s. IPA in slashes on v4; `<phoneme alphabet="cmu-arpabet" ph="...">` only on `eleven_flash_v2`. Normalise numbers/currency/dates to spoken words for smaller models.
WebSocket `wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input`: not usable from Vercel serverless for long sessions; skip.

## 5. Voices
- List `GET /v2/voices` (query `search`, `page_size` max 100, `next_page_token`, `sort`, `voice_type` personal|community|default|workspace|saved, `category` premade|cloned|generated|professional, `language`, `gender`, `age`, `accent`, `voice_ids`). Response `{voices[{voice_id,name,category,labels,preview_url,settings}], has_more, total_count, next_page_token}`. Use `has_more`.
- Instant clone `POST /v1/voices/add` (multipart): `name`, `files`, `remove_background_noise`, `description`, `labels`. Returns `{voice_id, requires_verification}`. File limits NOT STATED. Instant clones cannot be shared publicly.
- Professional clone: avoid in v1 (REST paths NOT STATED).
- Voice design `POST /v1/text-to-voice/design`: `voice_description` (20 to 1000 chars), `text` (100 to 1000), `model_id`, `auto_generate_text`, `loudness` -1..1 default 0.5, `seed`, `guidance_scale` 0..100 default 5. Response `{previews:[{audio_base_64, generated_voice_id, media_type, duration_secs, language}], text}`. Save with `POST /v1/text-to-voice` using `generated_voice_id` (+ `voice_name`, `voice_description`) -> `voice_id`.
- Consent: none in docs for instant clones; Eclipse adds its own checkbox.

## 6. Speech to text `POST /v1/speech-to-text` (multipart)
`model_id` (`scribe_v2`), one of `file` (under 5.0 GB) | `source_url` | `cloud_storage_url` (deprecated); `language_code`, `diarize` (default false), `num_speakers` 1..32, `diarization_threshold` 0.1..0.4, `timestamps_granularity` none|word|character (default word), `tag_audio_events` (default true), `keyterms` (up to 1000, +20 percent), `entity_detection`, `entity_redaction`, `no_verbatim`, `use_multi_channel`, `webhook`, `temperature`, `seed`, `transcript_edit` (+30 percent). Response `{language_code, language_probability, text, words[{text,type,start,end,logprob,speaker_id}]}`. Up to 10 hours.

## 7. Sound effects `POST /v1/sound-generation`
Query `output_format`. Body: `text` (required), `duration_seconds` (0.5 to 30; null = inferred), `prompt_influence` 0..1 default 0.3, `loop` default false, `model_id` (`eleven_text_to_sound_v2`). Response MP3; header `character-cost`.

## 8. Music `POST /v1/music` (paid plans only)
Query `output_format` (default `auto`). Body: `prompt` (max 4100 chars) OR `composition_plan` (not both), `music_length_ms` (3000 to 600000; only with prompt), `model_id` (send `music_v2_5` explicitly), `force_instrumental`, `seed` (not with prompt), `respect_sections_durations`, `store_for_inpainting`, `sign_with_c2pa` (MP3 only), `finetune_id`. Response audio bytes, header `song-id`. Errors: `bad_prompt` (copyrighted names or lyrics; has `prompt_suggestion`), `bad_composition_plan`. Never put artist names or lyrics in prompts.

## 9. Eclipse notes
Provider id `elevenlabs`: tts, stt, sfx, music, voice clone (instant), voice design. Ledger from `character-cost` where present, else config prices. Audio over 4.5 MB never through a Vercel route: R2 first, then `source_url`.
