# MiniMax audio reference (NOT STATED = test it)

## 1. Basics
Base URL `https://api.minimax.io`. Auth `Authorization: Bearer <MINIMAX_API_KEY>` (Secret).
EVERY response (even failures) is HTTP 200 with `base_resp: {status_code, status_msg}`: check `base_resp.status_code !== 0`, not the HTTP status. Exception: speech-to-text uses real HTTP statuses.
Error codes: 1000 unknown, 1001 timeout, 1002 rate limit (RPM), 1004 / 2049 auth, 1008 insufficient balance, 1013 and 1024 internal, 1026 sensitive input, 1027 sensitive output, 1033 system error, 1039 token limit, 1041 connection limit, 1042 more than 10 percent invalid characters, 1043 ASR similarity failed, 1044 clone prompt similarity failed, 2013 invalid parameters, 20132 invalid samples or voice_id, 2037 clone audio too short or long, 2038 no cloning permission (account verification), 2039 duplicate voice_id, 2042 no access to voice_id, 2045 rate growth limit, 2048 prompt audio too long (under 8 s), 2056 usage limit (wait for the next 5-hour window). Retryable: 1000, 1001, 1002, 1013, 1024, 1033, 1039, 2045.
Rate limits: TTS 60 RPM, voice cloning 60 RPM, voice design 20 RPM, STT concurrency 2 and 30,000 TPM (paid only).

## 2. Models (TTS)
`speech-2.8-hd` (best quality, interjection tags), `speech-2.8-turbo`, `speech-2.6-hd`, `speech-2.6-turbo`, `speech-02-hd`, `speech-02-turbo`, `speech-01-hd`, `speech-01-turbo`. 40 languages (`language_boost: "auto"` when unknown). 332 system voices. Get the live list with `POST /v1/get_voice {voice_type:"system"}`; do not hard-code.

## 3. Pricing
TTS: 2.8-hd and 2.6-hd/02-hd $100 per 1M chars; 2.8-turbo, 2.6-turbo, 02-turbo $60 per 1M. STT $0.38 per hour. Cloning $1.50 per voice at FIRST USE for synthesis. Design $3 per voice at first synthesis use; preview in the design API $30 or $60 per 1M chars (conflict; measure). Prices are config.

## 4. TTS sync `POST /v1/t2a_v2`
Body: `model`, `text` (under 10,000 chars; stream above 3,000), `stream` (false), `voice_setting {voice_id (required), speed 0.5..2, vol >0..10, pitch -12..12 integer, emotion happy|sad|angry|fearful|disgusted|surprised|calm|fluent|whisper (fluent/whisper only on 2.6; 2.8 no whisper), latex_read}`, `audio_setting {sample_rate 8000..44100, bitrate 32000|64000|128000|256000, format mp3 (default)|pcm|flac|wav|pcmu_raw|pcmu_wav|opus, channel 1|2, force_cbr}`, `pronunciation_dict {tone:["omg/oh my god"]}`, `timbre_weights`, `language_boost`, `text_normalization_mode basic|quality`, `subtitle_enable`, `subtitle_type sentence|word|word_streaming`, `output_format url|hex` (non-stream only; url expires 24 h; default hex), `voice_modify {...}`.
Markup: pause `<#1.5#>` (0.01 to 99.99 s); interjection tags only on 2.8: `(laughs) (chuckle) (coughs) (clear-throat) (groans) (breath) (pant) (inhale) (exhale) (gasps) (sniffs) (sighs) (snorts) (burps) (lip-smacking) (humming) (hissing) (emm) (sneezes)`.
Response: `data.audio` (hex, or URL), `data.status`, `data.subtitle_file`, `extra_info {audio_length ms, audio_sample_rate, audio_size, bitrate, audio_format, audio_channel, usage_characters, word_count}`, `trace_id`, `base_resp`. Decode hex to bytes; `data` can be null.

## 5. Async long text `POST /v1/t2a_async_v2`
Body: `model`, `text` (max 50,000) OR `text_file_id`, `voice_setting`, `audio_setting` (key `audio_sample_rate`), `pronunciation_dict`, `language_boost`, `voice_modify`. Response `{task_id, task_token, file_id, usage_characters, base_resp}`. Poll `GET /v1/query/t2a_async_query_v2?task_id=` (10 qps) -> Processing|Success|Failed|Expired (case-insensitive). Download `GET /v1/files/retrieve_content?file_id=`; available only 9 hours: copy to R2.

## 7. Voice cloning
1 `POST /v1/files/upload` multipart `purpose=voice_clone`, `file` (mp3/m4a/wav, 10 s to 5 min, max 20 MB). 2 optional prompt sample `purpose=prompt_audio` (under 8 s). 3 `POST /v1/voice_clone`: `file_id`, `voice_id` (8 to 256 chars, starts with a letter, letters/digits/-/_, unique), `clone_prompt {prompt_audio, prompt_text}`, `text` (preview, max 1000) + `model`, `language_boost`, `need_noise_reduction`, `need_volume_normalization`, `text_validation`, `accuracy`, `aigc_watermark`. A cloned voice is DELETED if not used for synthesis within 7 days. Cloned/designed voices appear in `get_voice` only after one successful synthesis. Manage: `POST /v1/get_voice {voice_type: system|voice_cloning|voice_generation|all}`; `POST /v1/delete_voice`. Consent: none in docs; Eclipse adds its own.

## 8. Voice design `POST /v1/voice_design`
Body `prompt`, `preview_text` (max 500), `voice_id` (optional). Response `{voice_id, trial_audio (hex), base_resp}`. Validity NOT STATED. 20 RPM.

## 9. STT `POST /v1/speech_to_text` (multipart; real HTTP statuses)
`model`=`asr-1.0`, `file` (wav, aiff, flac, m4a, mp3, aac, opus, ogg; max 500 s; max 50 MB), `response_format` json|verbose_json|srt|vtt, `timestamp_level`, `stream`. Optional header `language`. Errors 400, 401, 402, 413, 422, 429, 500, body `{type:"error", error:{type,message,http_code}, request_id}`. Paid only; 2 concurrent.

## 10. Music: CLOSED to new users (from 2026-08-20). Do NOT build.

## 11. Eclipse notes
Provider id `minimax-audio`: tts, tts-long, clone, design, stt. Hex decoding server-side; audio to R2; never keep hex in the DB. `base_resp.status_code` is the truth. Async long TTS for anything over 3,000 chars.
