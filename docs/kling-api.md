# Higgsfield Kling API reference (offline copy, from the owner, 2026-10-13)

Base `https://api.higgsfield.ai`, all `POST`, path segment `kling-video`. Common rules: headers `Authorization: Key <id>:<secret>`, `Content-Type`, `Idempotency-Key`; submit reply `{status:"queued", request_id, status_url, cancel_url}`, poll `status_url` to `completed` (`video.url`), end states `completed|failed|nsfw|canceled`; media URLs public https (signed R2 links; `asset://` rejected); NO `seed` on any Kling endpoint; no prices published; prompts over the maximum are truncated by the provider; `elements` (Kling element ids owned by the account) skipped in v1.

## Endpoints (25) and what Eclipse has built
| Endpoint | Built |
| --- | --- |
| `kling-video/v2.5-turbo/pro/text-to-video` | yes (Kling 2.5 Turbo Pro) |
| `kling-video/v2.5-turbo/pro/image-to-video` | yes |
| `kling-video/v2.5-turbo/standard/image-to-video` (folder `standard`, no text-to-video exists) | yes (Kling 2.5 Turbo Standard) |
| `kling-video/v2.6/pro/text-to-video`, `.../image-to-video` | yes (Kling 2.6 Pro) |
| `kling-video/motion-control/{pro,std}`, `kling-video/v3/motion-control/{pro,std}` (2.6 has no version, 3.0 is `v3`) | no |
| `kling-video/v3.0/{std,pro,4k}/{text,image}-to-video` (tier folder is `std`) | yes (Standard, Pro since 2026-10-12; 4K since 2026-10-13) |
| `kling-video/v3.0-turbo/{text,image}-to-video` (own folder, no tier) | yes (Kling 3.0 Turbo) |
| `kling-video/o3/{first-last-frame,image-reference,video-edit,video-reference}` | no |
| `kling-video/omni/{first-last-frame,image-reference,video-edit,video-reference}` | no |

## Fields built
- **2.5 Turbo** (Pro t2v; Pro and Standard i2v): `prompt` (required), `duration` 5 or 10, `cfg_scale` 0 to 1 step 0.01 (default 0.5), `negative_prompt`; i2v `image_url` required. No sound, aspect ratio, resolution.
- **2.6 Pro:** `prompt`, `duration` 5 or 10, `cfg_scale`, `sound` "on"/"off"; t2v `aspect_ratio` 16:9/9:16/1:1 (the i2v page lists it too, not sent: the shape follows the picture); i2v `image_url`. No negative prompt.
- **3.0 Std/Pro/4K:** `prompt` (always send non-empty, max 2,500), `duration` 3 to 15, `sound` on/off, `cfg_scale`, t2v `aspect_ratio`; i2v `image_url`, `last_image_url`, NO aspect ratio. Multi-shot (`multi_shots`, `multi_prompt` 1 to 6 items, each prompt max 512 and duration 1 to 15; summed shot duration overrides `duration` and is what is billed) is NOT built yet.
- **3.0 Turbo:** `prompt` (t2v max 3,072, i2v 2,500; Eclipse enforces 2,500 for both), `duration` 3 to 15, `resolution` 720p/1080p (default 720p), t2v `aspect_ratio`; i2v `image_url`. No sound, cfg, multi-shot, end frame, seed.

## Not built (needs new workflows)
Motion Control (`image_url` + `video_url` 3 to 30 s, `keep_original_sound` "yes"/"no" STRING, `character_orientation` image|video, no duration), O3 and Omni first-last-frame, image-reference, video-edit (exactly one `video_urls`, no duration, O3 source 3 to 15.5 s, Omni 3 to 10 s, max 200 MB) and video-reference (3 to 10 s), multi-shot. Field tables for these are in the owner's original reference (section 6 and 5); ask for it again or re-paste when building.

## Live test checklist
One cheap render per endpoint at the minimum duration (3 s for 3.0, 5 s for 2.x), lowest tier, sound off, 16:9; start with 3.0 Std i2v, Pro i2v, Std t2v, Pro t2v, Turbo i2v. Report HTTP status, exact error, request id, seconds queued to completed, MB, audio present, credits spent. On a 404 report the exact URL (usual causes: `standard` vs `std`, `v3` vs `v3.0`, `v3.0` vs `v3.0-turbo`, dashes instead of dots). Test what `cancel_url` does once on a Turbo render.
