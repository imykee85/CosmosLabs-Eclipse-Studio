# Qwen TTS reference (NOT STATED = test it)

## 0. Lineup
Qwen3-TTS: `qwen3-tts-flash` (HTTP, 17 system voices, no instructions), `qwen3-tts-instruct-flash` (natural-language style control, 25 voices), `qwen3-tts-vc` (cloned voices), plus `-realtime` WebSocket variants. Qwen-Audio-TTS (newer, WebSocket only): `qwen-audio-3.0-tts-plus`, `-flash`, `qwen-audio-3.1-tts-flash`. CosyVoice (WebSocket). v1 = `qwen3-tts-flash` (+ instruct) over plain HTTP only.

## 1. Basics
API keys are region specific: use a Singapore (international) key. Secret `DASHSCOPE_API_KEY`; Config `DASHSCOPE_REGION=sg`, `DASHSCOPE_BASE_URL`.
HTTP: `POST https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation` (docs label it both Singapore and Beijing). If a Singapore key fails try `https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`. Newer docs: `https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/...`. VERIFY with a real key.
Headers `Authorization: Bearer $DASHSCOPE_API_KEY`, `Content-Type: application/json`; streaming adds `X-DashScope-SSE: enable`. Rate limit 180 RPM.

## 2. Pricing
`qwen3-tts-flash` Singapore $0.10 per 10,000 chars; `qwen3-tts-instruct-flash` $0.115 per 10,000. `qwen3-tts-vc` and Qwen-Audio price NOT STATED. `usage.characters` returns the billed count.

## 3. Non-realtime TTS
```json
{ "model": "qwen3-tts-flash", "input": { "text": "...", "voice": "Cherry", "language_type": "English" } }
```
`input.text` max 600 chars per request (chunk). `input.voice` system voice name, case-sensitive (only `Cherry` confirmed; full list NOT READ). `input.language_type`: Auto | Chinese | English | German | Italian | Portuguese | Spanish | Japanese | Korean | French | Russian; set explicitly. `qwen3-tts-instruct-flash`: instruction parameter name NOT STATED (likely `instructions`; VERIFY).
Response: `{status_code, request_id, code, message, output:{finish_reason, audio:{data:"", url, id, expires_at}}, usage:{characters,...}}`. Audio is a WAV URL valid 24 hours: download to R2 immediately. Streaming SSE: base64 PCM 16-bit mono 24 kHz chunks; final chunk has `audio.url`. Errors: `status_code` 400/401/404/500 with `code`/`message`; 429 "Requests rate limit exceeded...".

## 4. Voice cloning (enrollment) HTTP
`POST https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/api/v1/services/audio/tts/customization`; body `{model:"voice-enrollment", input:{action:"create_voice", target_model, prefix, url}}` -> `output.voice_id`. Sample: public URL (signed R2 URL), WAV 16-bit/MP3/M4A, 10 to 20 s recommended, 60 s max, 10 MB max. 1,000 custom voices per account; auto-delete after 1 year unused. Cloned voices work with the WebSocket families, NOT `qwen3-tts-flash`. `qwen3-tts-vc` enrollment fields NOT READ. Consent: none in docs; Eclipse adds its own.

## 5. WebSocket: reference only, skip in v1.

## 7. Eclipse notes
Provider id `qwen-tts`, v1 tts only. Chunk text under 600 chars at sentence boundaries, concurrency under 180 RPM, concatenate. Download `audio.url` immediately to R2.
