# Higgsfield Seedance API reference (offline copy, from the owner, 2026-10-13)

Base `https://api.higgsfield.ai`, all `POST`, version in the path has a DOT (`seedance-2.0`, `seedance-2.5`; the dashed forms 404). Provider in the path is `bytedance`.

| Model | Workflow | Endpoint | Built in Eclipse |
| --- | --- | --- | --- |
| 2.0 | text to video | `bytedance/seedance-2.0/text-to-video` | yes |
| 2.0 | image to video | `bytedance/seedance-2.0/image-to-video` | yes |
| 2.0 | reference to video | `bytedance/seedance-2.0/reference-to-video` | no |
| 2.5 | text to video | `bytedance/seedance-2.5/text-to-video` | yes (2026-10-13) |
| 2.5 | image to video | `bytedance/seedance-2.5/image-to-video` | yes (2026-10-13) |
| 2.5 | reference to video | `bytedance/seedance-2.5/reference-to-video` | no |
| 2.5 | video edit | `bytedance/seedance-2.5/video-edit` | no |
| 2.5 | video extend | `bytedance/seedance-2.5/video-extend` | no |

## All eight
- Headers `Authorization: Key <id>:<secret>`, `Content-Type: application/json`, `Idempotency-Key`.
- `additionalProperties: false`: send only listed fields. No `seed`, `negative_prompt`, `cfg_scale` on any Seedance endpoint (Seed, Negative prompt, CFG are greyed for Seedance). Only audio control: boolean `generate_audio` (default true).
- Media URLs must be public https; `asset://` is rejected (use short-lived signed R2 URLs).
- Submit reply `{status:"queued", request_id, status_url, cancel_url}`; poll `status_url` until `completed` (`video.url`); other end states `failed`, `nsfw`, `canceled` (the Seedance pages show only queued/completed; full list taken from other Higgsfield pages, confirm in the first live test). No prices published.
- `prompt`: where required, min length 1; no maximum stated.

## Fields
- **2.0 text/image/reference:** `duration` 4 to 15 (default 5); `resolution` 480p/720p/1080p/4k (default 720p); `aspect_ratio` 16:9, 4:3, 1:1, 3:4, 9:16, 21:9 (default 16:9; text and reference only, image follows the picture). Image: `image_url` required, `end_image_url` optional. Reference: `image_urls` 1 to 9 or `video_urls` 1 to 3 (one of them required; audio alone is invalid), `audio_urls` 1 to 3; do not mix with `image_url`/`end_image_url`/`video_url`.
- **2.5:** `duration` 4 to 30; `resolution` 480p/720p/1080p (no 4k); `bitrate_mode` standard/high (default high); text to video also `output_format` mp4/mov (default mp4) and prompt required; image to video has `image_url` (required), `end_image_url`, no aspect ratio. Reference: `image_urls` 1 to 30, `video_urls` 1 to 10, `audio_urls` 1 to 10 (at least one array; audio alone allowed; at most 50 items in all), has `aspect_ratio`, no `output_format`.
- **2.5 edit / extend:** `prompt` and `video_url` required; optional `image_urls` (1 to 30), `video_urls` (at most 9, the source counts toward 10), `audio_urls` (1 to 10), `resolution`, `bitrate_mode`, `generate_audio`; at most 50 media items. Edit sends NO `duration` and no aspect ratio; extend has `duration` 4 to 30 (length of the extension). Framing follows the source video. Source length limits are not stated (confirm live).

## Live test checklist (owner runs, one cheap render each: 4 s, 480p, audio off)
2.0 t2v, 2.0 i2v, 2.0 ref (one image), 2.5 t2v, 2.5 i2v, 2.5 ref, 2.5 edit, 2.5 extend. Report per row: HTTP status, exact error text, request id, queued-to-completed seconds, MB, audio present, credits spent. On a 404 report the exact URL (usual cause: `seedance-2-0` instead of `seedance-2.0`). On a validation error paste it verbatim; do not change the registry silently.
