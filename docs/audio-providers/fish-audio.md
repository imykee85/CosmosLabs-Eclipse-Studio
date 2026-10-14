# Fish Audio reference (NOT STATED = test it)

## 1. Basics
Base URL `https://api.fish.audio` (WebSocket `wss://api.fish.audio/v1/tts/live`, skip). Auth `Authorization: Bearer <FISH_API_KEY>` (Secret). Specs: `https://docs.fish.audio/api-reference/openapi.json`, index `https://docs.fish.audio/llms.txt`.
Errors JSON `{status, message, reason?}`; some edge errors (413, 5xx) have no JSON body. 401 bad key, 402 out of credit, 429 concurrency limit (no `Retry-After`; backoff), 503 overloaded (retry). Optional header `traceparent`.
Concurrency by total prepaid: under $100 = 5, $100+ = 15, $1,000+ = 50 (simultaneous, shared across keys). Plain `fetch`, no SDK.

## 2. Models (header `model`)
`s2.1-pro` (production, 83 languages, bracket control, multi-speaker, $15 per 1M UTF-8 bytes), `s2.1-pro-free` (same, free, fair use, no latency/DPA guarantees, only through 2026-11-30), `drama-3` (2026-10-13: plain-language direction, paired tags, language switching experimental; price NOT STATED), `s2-pro` ($15 per 1M bytes), `s1` DEPRECATED retires 2026-12-31 (do not register; uses `(parenthesis)` tags).
A missing or unknown `model` header silently falls back to `s2.1-pro`: always send it. Cost is bytes not characters (English about 1 byte per char; CJK about 3). 1,000 English chars about $0.015.

## 3. TTS `POST /v1/tts`
Headers: Bearer, `Content-Type: application/json` (or msgpack), `model`. Body (only `text` required): `text`, `reference_id` (string or array = multi-speaker), `references` [{audio,text}] (inline cloning; needs MessagePack), `temperature` 0..1 (0.7), `top_p` 0..1 (0.7), `repetition_penalty` (1.2), `max_new_tokens` (1024), `prosody {speed 0.5..2.0 (1), volume dB (0), normalize_loudness (true, S2 only)}`, `chunk_length` 100..300 (300), `min_chunk_length` 0..100 (50), `normalize` (true), `format` mp3 (default)|wav|pcm|opus, `sample_rate` (null = 44100; 48000 opus), `mp3_bitrate` 64|128|192, `opus_bitrate` -1000|24000|32000|48000|64000, `latency` normal|balanced|low, `condition_on_previous_chunks` (true), `early_stop_threshold` 0..1, `features` (e.g. ["quality-guard"]), `pronunciation_dictionary`.
Response 200 chunked audio bytes (stream it). Multi-speaker: `reference_id: ["a","b"]` and turns start with `<|speaker:0|>`, `<|speaker:1|>`.
NOT STATED: max text length, per-endpoint rate limits, language list beyond "83 languages".

## 4. Emotion and delivery (S2 family)
Bracket cues: `[happy] What a day!`, free-form natural language accepted (`[slightly sad]`, `[whispering]`, `[emphasis]`, `[laughing]`, `[sighing]`, `[break]`, `[long-break]`). 24 basic emotions (happy, sad, angry, excited, calm, nervous, confident, surprised, satisfied, delighted, scared, worried, upset, frustrated, depressed, empathetic, embarrassed, disgusted, moved, proud, relaxed, grateful, curious, sarcastic) and 25 advanced. Rules: sentence-level emotion at the START of the sentence; one primary emotion per sentence; at most 3 combined; tags cost no tokens or latency; add spoken text after sound effects. NEVER send `(happy)` to an S2 model (API does not convert).
`drama-3`: plain-language brackets, paired tags `<whisper> <emphasis> <soft> <fast> <slow> <stress> <forceful>`, experimental language switching tags, phonemes `<|phoneme_start|>...<|phoneme_end|>`.

## 5. Voices
- Instant clone: `references` inline (msgpack); clean 10 to 30 s sample plus transcript.
- Saved clone `POST /model` (multipart): `type`="tts", `title`, `train_mode`="fast", `voices` (1 to 20 files); optional `visibility` (`private` default; public downgraded to private), `description`, `cover_image`, `texts`, `tags`, `enhance_audio_quality` (true), `generate_sample`, `voice_design_signatures`. Response 201 with `_id` (use as `reference_id`) and `state` (created|training|trained|failed). Audio: wav, mp3, m4a, opus; at least 10 s per clip; size limits NOT STATED.
- `GET /model` (query `page_size` 1..100, `page_number`, `title`, `tag`, `self`, `author_id`, `language`, `licensed`, `sort_by`) -> `{total, items[], has_more}`. `GET/PATCH/DELETE /model/{id}`.
- Consent: clone only own voice or with written permission; Eclipse shows a consent checkbox and never lets users publish a cloned voice.

## 6. Voice design `POST /v1/voice-design`
Headers Bearer, JSON, `model: voice-design-1`. Body (`additionalProperties:false`): `instruction` (1..2000), `reference_text` (null, max 150), `language`, `n` 1..4 (2), `speed` (1), `num_step` 1..128 (32), `guidance_scale` (2), `instruct_guidance_scale` (0), `seed`. Response `{candidates:[{id,index,audio_base64 (WAV),sample_rate,duration_ms,...}]}`. Stateless; to keep one pass its signature in `voice_design_signatures` to `POST /model` (flow unexplained; test). $0.01 per successful request.

## 7. Pronunciation dictionaries
`pronunciation_dictionary` on `/v1/tts`: up to 3 managed refs `{id, version}` OR inline `{items:[{key,value,case_sensitive}]}` (max 5000). An unresolved id is silently skipped.

## 9. Speech to text `POST /v1/asr` (BETA, synchronous)
Headers: Bearer, `model: transcribe-1-pro` or `transcribe-1`, multipart/form-data or msgpack. Fields: `audio`, `language`, `ignore_timestamps` (true), `tag_audio_events`, `diarize` auto|true|false, `num_speakers`/`min_speakers`/`max_speakers`. Response `{text, duration, segments[], speaker_turns[], language, language_code, request_id}`. Pro up to 60 min (else 400 `audio_too_long`), 413 if too large. Use a long client timeout (about 900 s). $0.36 per audio hour per started second. Not supported: AIFF, CAF, WMA, AMR, AC-3, raw PCM.

## 10. Eclipse notes
Provider id `fish`: `s2.1-pro`, `s2.1-pro-free`, `drama-3`; price per 1M bytes configurable. Samples and ASR files go to R2 first. Free model must still deduct Eclipse credits or be gated; config switch before 2026-11-30.
