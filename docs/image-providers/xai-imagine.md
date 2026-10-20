# xAI Grok Imagine image reference for Eclipse
Copied by Claude on 2026-10-20 from the official pages (sources: docs.x.ai images/generation, images/editing, guides/image-generation, models). Items marked NOT ON PAGE are unknown. Do not fill them from memory. Secret: `XAI_API_KEY`.

## Auth and model
- Header `Authorization: Bearer $XAI_API_KEY`, `Content-Type: application/json`.
- Model: `grok-imagine-image-2.0` (the only model shown). The nav shows an "Imagine Image Quality" retirement notice dated 2026-11-02; check it does not affect this model before launch.

## Generate: `POST https://api.x.ai/v1/images/generations`
| Field | Type | Values | Default |
|---|---|---|---|
| model | string | `grok-imagine-image-2.0` | not stated |
| prompt | string | text | not stated |
| n | integer | 1 to 10 | 1 |
| aspect_ratio | string | 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3, 2:1, 1:2, 19.5:9, 9:19.5, 20:9, 9:20, 21:9, 5:2, auto | auto |
| resolution | string | `1k`, `2k` | 1k |
| quality | string | `low`, `medium`, `auto` | auto (low for generation, medium for editing) |
| response_format | string | `url`, `b64_json` | url |
| deferred | boolean | true/false | not stated |
- Eclipse: always send `quality: "low"`, `n: 1`; resolution as chosen (1k or 2k).
- Sync response: `data[]` with `url` or `b64_json` (and `mime_type`), plus `usage` and a moderation flag `respect_moderation`. URLs are temporary (expiry not stated): download to R2 immediately.
- Deferred mode (not used): submit returns `{"request_id"}`; poll `GET /v1/images/{request_id}`: 202 pending, 200 done, 200 with `error` failed; results kept 24 hours; `url` only.

## Edit: `POST https://api.x.ai/v1/images/edits`
- JSON only (multipart and the OpenAI SDK `images.edit()` are NOT supported). From the examples: `model`, `prompt`, `image` = `{"url": "...", "type": "image_url"}`. Source can be a public URL, a base64 data URI, or a `file_id`. The overview says up to 5 source images. NOT ON PAGE: how several images are sent, size limits, other optional fields, REST response shape.
- Edits are billed for BOTH the input image(s) and the output image.

## Price
- Overview: "$0.04 / image", flat. Models page: "Starting at $0.02 / image" (model not named). NOT ON PAGE: price by quality/resolution, edit input-image price, rate limits, error list. Owner to screenshot xAI's Pricing page for `grok-imagine-image-2.0`; until then $0.04 flat as in the master.
