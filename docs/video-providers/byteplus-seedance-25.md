# BytePlus ModelArk: Dreamina Seedance 2.5 (read from the owner's screenshots, 2026-10-20)

SOURCE: two phone screenshots of the model page on ai.byteplus.com (Model Square). NOT the API reference. NOTHING here is verified against the live API. The request and response fields are still MISSING (see the bottom): do not build the adapter from this page alone.

## What the model page says
- Name: Dreamina-Seedance-2.5 (version tag 260628, "Top Pick"). Model ID shown: `dreamina-seedance-2-5-260628`.
- Task types: multimodality-to-video, Edit, Video extension.
- Inputs: text, image, video, audio. Up to 50 reference assets in one run (30 images, 10 videos, 10 audio files).
- Output: resolution 480p, 720p, 1080p; duration 4 to 30 s; 24 fps.
- Limits: 10 concurrent tasks, RPM 0.6k (600 requests a minute).
- API: "Contents Generations", path `/v3/contents/generations`.
- Pricing: TOKEN based. Video fee = token unit price x token dosage (higher resolution costs more than lower). The screenshot shows only the 480P row: 6.4 USD per million tokens WITH video input, 10.7 USD per million tokens WITHOUT video input. The 720p and 1080p rows were not shown (the page has an "Output resolution" dropdown). The page links a "Price example" that explains how many tokens a clip uses.

## Compare with what Eclipse already assumes (`docs/seedance-api.md`, `src/lib/video-models.ts`)
- Eclipse's Seedance 2.5 limits (4 to 30 s, 480p to 1080p, up to 30 pictures, 10 clips, 10 sounds) MATCH this page.
- Edit and Extend exist on this API too (Eclipse already does them through Higgsfield).

## STILL NEEDED before an adapter can be built (ask the owner for the page text)
1. The "Create a video generation task" API page: request address and headers, the body (`model`, `content` items with types and roles for text, image, video and audio, `resolution`, `duration`, `ratio`/aspect ratio, `seed`, `watermark`, `generate_audio` ...), and the answer (task id).
2. The "Query task" page: status words, where the finished video address is, error shape, `usage` (token count).
3. The "Price example" explanation: how tokens are counted from resolution, duration and fps, so a price per second can be worked out for 480p, 720p and 1080p, with and without video input.
4. Edit and Extend request differences (the owner may skip these at first).
5. Base address and authentication: Seedream already works through `https://ark.ap-southeast.bytepluses.com/api/v3` with `Authorization: Bearer <ARK_API_KEY>`; confirm the same applies to this path and that the model must be "activated" in the console (Seedream returned `ModelNotOpen` until it was).

## PRICE TABLES (read from the owner's screenshots of the BytePlus "Help documentation" price page, 2026-10-20; USD, 16:9, 5 s outputs)
Source: three phone screenshots. Verified against the provider's page by eye, not through the API. The Seedance 1.5 Pro table was cut off (not captured).

### Seedance 2.5, INPUT WITHOUT VIDEO
| Resolution | per 5 s video | per second |
| --- | --- | --- |
| 480p | 0.514 | 0.103 |
| 720p | 1.156 | 0.231 |
| 1080p | 2.843 | 0.569 |

### Seedance 2.5, INPUT WITH VIDEO (5 s output; the price depends on the length of the input video, 2 to 30 s)
| Resolution | per 5 s video | lowest = 2 to 4 s input, highest = 30 s input |
| --- | --- | --- |
| 480p | 0.553 to 2.152 | |
| 720p | 1.244 to 4.838 | |
| 1080p | 3.062 to 11.907 | |

### Seedance 2.0 series, INPUT WITHOUT VIDEO (5 s output)
| Model | 480p | 720p | 1080p | 4K |
| --- | --- | --- | --- | --- |
| 2.0 | 0.35 per video, 0.07 per s | 0.76, 0.15 per s | 1.87, 0.37 per s | 3.89, 0.78 per s |
| 2.0 Fast | 0.28, 0.06 per s | 0.60, 0.12 per s | not supported | not supported |
| 2.0 Mini | 0.18, 0.04 per s | 0.38, 0.08 per s | not supported | not supported |

### Seedance 2.0 series, INPUT WITH VIDEO (input video 2 to 15 s, 5 s output; lowest = 2 to 4 s input, highest = 15 s input)
| Model | 480p | 720p | 1080p | 4K |
| --- | --- | --- | --- | --- |
| 2.0 | 0.39 to 0.86 | 0.84 to 1.86 | 2.06 to 4.57 | 4.20 to 9.33 |
| 2.0 Fast | 0.30 to 0.66 | 0.64 to 1.43 | not supported | not supported |
| 2.0 Mini | 0.19 to 0.42 | 0.41 to 0.91 | not supported | not supported |

### Token prices on the model page (per 1,000 tokens, shown while activating)
- With video input: $0.0064 to $0.0070. Without video input: $0.0107 to $0.0117.

### Activation
Activating the model in the console failed with `OperationDenied: No available resource packs. Please purchase a resource pack first.` (action `OpenModelChargeItem`). The BytePlus account needs a prepaid resource pack or balance before the model can be used through the API. BytePlus has no spending-limit feature, so the balance is the cap.

### Check against what the code assumes (`directUsd` in `src/lib/video-models.ts`, brief section 8)
- Seedance 2.5 (no video input): code 480p 0.1075, 720p 0.2311, 1080p 0.5686 per second; provider page 0.103, 0.231, 0.569. 720p and 1080p MATCH; 480p is 4% above the page (safe side).
- Seedance 2.0 (no video input): code 480p 0.0643, 720p 0.1382, 1080p 0.311 per second; provider page 0.07, 0.15, 0.37. The code is LOW by 8%, 8% and 16%, so the direct route would earn less margin than the brief designs for. NOT changed yet: the owner decides whether to update `directUsd` (the price test in `tests/integration/price-dry-run.test.ts` would need the same update).
- Seedance 2.0 4K: provider page 0.78 per second without video input (Higgsfield-only today).
- Video-input pricing is per clip and depends on the input length: Eclipse's per-second model cannot represent it without the input duration (a later step).

## CREATE-TASK REQUEST EXAMPLE (BytePlus' own curl sample, pasted by the owner 2026-10-20; the API KEY in the paste was REDACTED here and must be rotated)
Not verified against the live API; read from the provider's sample only.

```
POST https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks
Content-Type: application/json
Authorization: Bearer <ARK_API_KEY>

{
  "model": "dreamina-seedance-2-5-260628",
  "content": [
    { "type": "text", "text": "<prompt; refers to inputs as Image 1, Video 1, Audio 1 in the order given>" },
    { "type": "image_url", "image_url": { "url": "https://..." }, "role": "reference_image" },
    { "type": "image_url", "image_url": { "url": "https://..." }, "role": "reference_image" },
    { "type": "video_url", "video_url": { "url": "https://...mp4" }, "role": "reference_video" },
    { "type": "audio_url", "audio_url": { "url": "https://...mp3" }, "role": "reference_audio" }
  ],
  "generate_audio": true,
  "ratio": "16:9",
  "duration": 11,
  "watermark": false
}
```
What this tells us:
- Same host, base path and `Authorization: Bearer` header as Seedream (`https://ark.ap-southeast.bytepluses.com/api/v3`); the path is `/contents/generations/tasks` (the model page said `/v3/contents/generations`).
- Inputs are a `content` array of typed items with a `role`: text, `image_url` (`reference_image`), `video_url` (`reference_video`), `audio_url` (`reference_audio`). Items are addressed in the prompt by order ("Image 1", "Video 1", "Audio 1"), which matches how Eclipse already numbers references.
- Top-level fields seen: `generate_audio` (bool), `ratio` (like "16:9"), `duration` (seconds, 11 in the sample), `watermark` (bool). `resolution` and `seed` were NOT in the sample.
- Reference files are public URLs (Eclipse already makes signed links for them).

STILL MISSING: the QUERY-TASK page (the address to poll, the status words, where the finished video address is, the error shape, token usage), the field names for resolution, first and last frame (their `role` names) and seed, and how Edit and Extend are sent. Ask the owner for those pages.

## VIDEO GENERATION TUTORIAL (BytePlus page, pasted by the owner 2026-10-21; read from the provider's page, NOT verified against the live API)
Base `https://ark.ap-southeast.bytepluses.com/api/v3`, `Authorization: Bearer <ARK_API_KEY>`.
- CREATE: `POST /contents/generations/tasks` answers `{ "id": "cgt-..." }`.
- QUERY: `GET /contents/generations/tasks/{id}`. Status words: `queued`, `running`, `succeeded`, `failed`, `expired`. Succeeded answer: `content.video_url` (the finished MP4), `usage.completion_tokens` / `usage.total_tokens` (the tokens billed), `seed`, `resolution`, `ratio`, `duration`, `framespersecond` (24), `service_tier`, `execution_expires_after`, `created_at`, `updated_at`; `content.last_frame_url` when `return_last_frame: true`. Failed: an `error` object with `code` and `message` (exact JSON shape not shown).
- LIST: `GET /contents/generations/tasks?page_size=&filter.status=`. CANCEL/DELETE: `DELETE /contents/generations/tasks/{id}` (cancels a queued task, or deletes the record).
- WEBHOOK: `callback_url` on create; POSTs `{id, model, status, created_at, updated_at, service_tier, execution_expires_after}` on each status change.
- BODY FIELDS: `model`, `content[]`, `generate_audio`, `ratio` (16:9, 4:3, 1:1, 3:4, 9:16, 21:9, `adaptive`), `resolution` (480p, 720p, 1080p, 4k), `duration` (2.5: 4 to 30 whole seconds or -1 = model chooses), `seed`, `camera_fixed`, `watermark`, `return_last_frame`, `service_tier` (`default`; `flex` is NOT for 2.5 or 2.0), `execution_expires_after`, `draft` (2.5 and 1.5 Pro only).
- CONTENT ITEMS: `{type:"text",text}`; first frame `{type:"image_url", image_url:{url}}` (role `first_frame` when two frames are sent); `{type:"image_url", ..., role:"last_frame"}`; reference items use `role` `reference_image` / `reference_video` / `reference_audio`; a draft is `{type:"draft_task", draft_task:{id}}`. Asset ids may replace URLs.
- SEEDANCE 2.5: Edit video and first-frame, first-and-last-frame, edit and extend tasks allow ONLY `ratio: "adaptive"`; Edit allows ONLY `duration: -1` (output length follows the input). Details are on the Seedance 2.5 tutorial page (`/docs/seedance-2-5`), not yet seen.
- INPUT LIMITS: images 30 MB each, 300 to 6000 px a side, ratio 0.4 to 2.5, 2.5 takes 1 to 30 reference images (2.0 takes 1 to 9); videos mp4/mov H.264 or H.265, 2 to 30 s each (edit tasks 4 to 30 s), up to 10 clips and 30 s in all on 2.5, 200 MB each, 24 to 60 fps; audio wav/mp3, 2 to 30 s each, up to 10 and 30 s in all on 2.5, 15 MB each; request body 64 MB. Images are centre-cropped to the chosen ratio. Real human faces cannot be uploaded directly (a portrait-asset flow exists, see their `seedance-portrait-asset-guide`).
- OUTPUT SIZES on 2.5 (pixels): 480p 16:9 854x480, 720p 1280x720, 1080p 1920x1080; 9:16 480x854, 720x1280, 1080x1920; 1:1 640, 960, 1440; 4:3 752x560, 1112x834, 1664x1248; 21:9 992x432, 1470x630, 2206x946. 2.5 has no 4k. 24 fps, MP4.
- RETENTION AND LIMITS: task records 7 days; the video link lives 24 HOURS and downloads 100 times, so Eclipse must copy the file to its own storage at once (it already does this for other providers). Over-limit requests answer 429. Status check limit is 20 queries a second per account.
- OUR REGISTRY NOTE: the 2.5 start-frame route in Eclipse sends no ratio (follows the picture), which matches BytePlus's `adaptive`.

STILL MISSING: the Seedance 2.5 tutorial page (`/docs/seedance-2-5`: edit/extend request shape, draft mode and its token factor, constraint table), the Price example (how output tokens are counted, e.g. the 246,840 tokens for 5 s at 1080p in the sample), and the exact failed-task `error` JSON.
