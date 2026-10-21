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

## SEEDANCE 2.5 TUTORIAL (BytePlus page `/docs/seedance-2-5`, pasted by the owner 2026-10-21; read from the provider's page, NOT verified against the live API)
TASK TYPES (decided by inputs + prompt; new top-level field `omni_reference_task_type`: `auto` | `reference` | `edit` | `extend`, sent as an extra body field):
- Text-to-video: text only. Any ratio and duration.
- First frame / first+last frame: image items with `role` `first_frame` (and `last_frame`). `ratio` MUST be `adaptive` (output follows the first-frame picture). Duration 4 to 30 or -1.
- Reference-to-video (omni): items with `reference_image` / `reference_video` / `reference_audio`. Any ratio and duration. Up to 50 assets: 30 images + 10 videos + 10 audios. Audio alone is allowed on 2.5 (2.0 needs a picture or video too).
- EDIT: `omni_reference_task_type: "edit"`, at least one `reference_video` of 4 to 30 s, `ratio: "adaptive"`, `duration: -1` (output keeps the source's ratio and length, up to 0.4 s shorter), prompt must contain an edit intent (add, remove, replace, change, "edit the video"). Prompt example: "Video edit: remove everyone in @Video1 except the protagonist."
- EXTEND: `omni_reference_task_type: "extend"`, at least one `reference_video`, `ratio: "adaptive"`, `duration` 4 to 30 or -1 (the length asked is the OUTPUT length), prompt must contain extend/continue wording ("Extend @Video 1 backward ...").
- Mismatch errors: `InvalidParameter.TaskTypeMismatch` and `InvalidParameter.TaskTypeConstraint` (asynchronous, the task fails after creation). With `auto` or no type, use `adaptive` + `-1` to be safe.
- PROMPTS refer to inputs as `@Image1`, `@Video1`, `@Audio1` (also "@Video 1") in the order given: THIS ANSWERS the open question, Seedance reads @ tags. Sound markers in prompts: `()` music, `<>` sound effects, `{}` dialogue, `【】` subtitles. 11 languages for prompt and speech.
OUTPUT:
- `resolution` default `720p`; 480p and 720p are 8-bit; 1080p is 10-BIT H.265/HEVC (may not play in some browsers and players: Chromium cannot decode it without hardware support; Eclipse's in-app player may fail on 1080p clips and Safari/iOS is fine). 2.5 has no 4k.
- `output_format`: `mp4` (default) or `mov` (H.264, yuv444p, PCM audio; for editing and extending, BytePlus recommends mov in and out; may not play in a browser).
- `ratio` default `adaptive` (text and reference tasks pick from 16:9, 4:3, 1:1, 3:4, 9:16, 21:9 by prompt). `duration` default -1 (model picks, 4 to 30 whole seconds). `watermark` default false. `seed`, `generate_audio` as before.
- Asset ids: items may use `asset://asset-...` instead of a URL (portrait/trusted assets flow, see their portrait guide). Real human faces cannot be uploaded directly.
DRAFT MODE (2.5 only): step 1 `draft: true` with `resolution: "480p"` (billed as a normal 480p video); step 2 create with `content: [{type:"draft_task", draft_task:{id}}]`, `resolution: "1080p"` ONLY, model the same, `draft` omitted; prompt, assets, duration, ratio, seed, generate_audio and task type are reused and MUST NOT be sent again (even equal values error); may be set again: `return_last_frame`, `output_format`, `watermark`, `service_tier`, `execution_expires_after`, `priority`, `callback_url`, `safety_identifier`. The draft id lives 7 days. Step 2 is billed at the 1080p rate, with the token rate chosen by whether step 1 had an input video, and input-video duration counted from step 1's inputs.
ACTIVATION: needs account balance above USD 30, or an AI Savings Plan of USD 30 or more, or a Seedance 2.5 resource pack. Quickstart zip and a prompt skill (`sd25-pe`) exist on their page.
RATE LIMITS (per primary account, per model across versions): enterprise 600 RPM and 10 concurrent tasks; individual 180 RPM and 3 CONCURRENT tasks (extra tasks queue). Eclipse must queue or fall back to Higgsfield above the concurrency cap.
INPUT LIMITS repeated: images 30 MB, 300 to 6000 px, ratio 0.4 to 2.5, formats jpeg png webp bmp tiff gif heic heif; videos mp4/mov H.264 or H.265, 2 to 30 s (edit 4 to 30 s), up to 10 and 30 s in all, 200 MB each, 24 to 60 fps, 409k to 8.3M total pixels; audio wav/mp3, 2 to 30 s each, up to 10 and 30 s in all, 15 MB each; body 64 MB.

STILL MISSING: the exact failed-task `error` JSON, and the extra `priority` / `safety_identifier` meanings (not needed for a first version). The Price example is NOT needed: per-second tables cover plain jobs and the returned `usage` settles the rest.

## BUILT (2026-10-21): the direct BytePlus Seedance route (default OFF, Higgsfield stays the fallback)
Code: `src/lib/providers/byteplus-video.ts` (body, submit, status, cancel), `src/lib/video-submit.ts` (route choice, fallback, the 3-at-once cap), wired into `src/lib/start-video.ts` (Video Studio) and `src/lib/video-edit.ts` (Edit and Extend); `videoStatus` / `cancelVideo` in `src/lib/higgsfield-video.ts` hand a BytePlus address to the BytePlus code (the key only ever goes to the configured BytePlus host). Models: `seedance_2_5` and `seedance_2_0` (reference mode, start/end frame, text, Edit, Extend on 2.5).
- SWITCH (Config values): `ROUTE_SEEDANCE_2_5=direct` and/or `ROUTE_SEEDANCE_2_0=direct`, plus the Secret `ARK_API_KEY`. Anything else = Higgsfield, nothing changes for users. Optional Config: `ARK_VIDEO_MAX_CONCURRENT` (default 3, the individual-account limit), `ARK_VIDEO_MODEL_SEEDANCE_2_5` / `ARK_VIDEO_MODEL_SEEDANCE_2_0` (model ids if BytePlus issues a new dated version), `ARK_BASE_URL`.
- PRICE follows the route that really runs: direct uses `directUsd` (cheaper), a video that goes to Higgsfield is priced there. The hold is raised to the Higgsfield price if a direct start is refused and the balance allows; otherwise the start fails and nothing is charged.
- WHEN HIGGSFIELD RUNS INSTEAD: the switch is off, the key is missing, BytePlus already runs `ARK_VIDEO_MAX_CONCURRENT` of our jobs, or BytePlus refuses the start (4xx/5xx, no connection). An UNCLEAR outcome (timeout, dropped connection, reply without a task id) is NOT retried elsewhere, so nobody pays twice: the start fails and the hold is released.
- The row records `provider: "byteplus"`, the task address as `statusUrl` and `cancelUrl`, `params.route` (`direct` or `higgsfield-fallback`), and BytePlus' `usage` tokens in `providerUsage` when it finishes. The finished file is copied to our storage as for every video (BytePlus' link lives 24 hours).
- Reference prompts: Eclipse numbers references the way BytePlus reads them (image 1, video 1, audio 1 in the order sent); `omni_reference_task_type` is sent for 2.5 (`reference`, `edit`, `extend`); first frame / Edit / Extend send `ratio: adaptive`, Edit sends `duration: -1`.
- NOT BUILT: Seedance draft mode (the registry has no draft switch), `.mov` output, asset ids (portrait flow), Seedance 2.0 Fast/Mini, a re-encode of 1080p H.265 for browsers that cannot play it, a webhook (`callback_url`; polling is used).
- NOT TESTED LIVE (sandbox cannot reach BytePlus, no prepaid pack yet): the real request and reply shapes, `expired`/cancel status words, whether 2.0 accepts every field sent, 1080p playback in the Eclipse player. Tested against a fake BytePlus: `tests/unit/byteplus-video.test.ts`, `tests/integration/byteplus-video.test.ts`.
- OWNER TEST PLAN: activate Seedance 2.5 in the BytePlus console (balance above USD 30 or a resource pack), set `ROUTE_SEEDANCE_2_5=direct` as a Config value for Preview first, make one cheap 4 s 480p render, then read `/admin/jobs` (provider, route, tokens) and compare `providerUsage.total_tokens` with BytePlus' bill. If anything fails the render is on Higgsfield automatically; remove the setting to switch off.
- PRICE CHECK still open: the 2.0 `directUsd` estimates are 8% to 16% below BytePlus' real list (480p 0.07, 720p 0.15, 1080p 0.37 USD per second vs ours 0.0643, 0.1382, 0.311). Not changed without the owner's word.

## SEEDANCE 2.0 SERIES TUTORIAL (BytePlus page `/docs/seedance-2-0`, pasted by the owner 2026-10-21; the API key in the pasted curl was left out; read from the provider's page, NOT verified live)
- Models: `dreamina-seedance-2-0-260128` (best quality, 480p/720p/1080p 8-bit and 4k 10-bit H.265), `dreamina-seedance-2-0-fast-260128` and `dreamina-seedance-2-0-mini-260615` (both 480p/720p only). All: ratios 21:9, 16:9, 4:3, 1:1, 3:4, 9:16 (`adaptive` accepted for frames), 4 to 15 s (or -1), mp4, with sound. No draft mode, no offline (`flex`) mode. Eclipse has only `seedance_2_0` (Fast and Mini are NOT in the registry).
- Same activation as 2.5 (balance above USD 30, AI Savings Plan, or a 2.0 resource pack).
- Omni reference: text + images (0 to 9) + videos (0 to 3) + audio (0 to 3); "text + audio" and audio alone are NOT allowed (matches our registry). Referencing is by type and order ("Image n" = the nth `image_url` item, counted from 1; asset ids cannot be referenced in the prompt). First/last frame as reference pictures only "indirectly", for exact frames use `first_frame` / `last_frame` roles.
- Edit video and Extend video exist on 2.0 too, driven by the prompt through omni reference (no task-type field, no `adaptive`/-1 rule as in 2.5): replace/add/delete/modify with a reference video and pictures; extend forward or backward, or give 2 to 3 clips to stitch/fill (the result then includes the originals). To keep the original footage in an extension, say "... and then end with Video 1". Eclipse's Edit/Extend dialog is Seedance 2.5 only; 2.0 Edit/Extend is NOT built.
- 4K: `resolution: "4k"` (ratio `adaptive` in the sample). Output is 10-bit H.265: plays in Safari (and QuickTime, VLC, mpv); Chrome, Edge and Firefox only with strong hardware decoding (Windows: e.g. Intel i7 + RTX 4070; macOS: Apple M2 or newer). The Eclipse player may not show a 4K clip in some browsers; the file downloads fine.
- RATE LIMITS (per primary account, per model across versions): non-4K 600 RPM and 10 concurrent (enterprise), 180 RPM and 3 concurrent (individual); 4K: 15 RPM and 1 CONCURRENT for both. Eclipse: `ARK_VIDEO_MAX_CONCURRENT` (3) for all BytePlus jobs together, and ONE 4K job at a time, the rest go to Higgsfield (`src/lib/video-submit.ts`).
- FAQ: "frames jump or stretch" in first/last-frame jobs happens when the picture's shape differs from the output: crop the picture to the output size and set `ratio: adaptive` (Eclipse sends `adaptive` for start-frame jobs).
- Prompt formula: omni reference = reference/extract/combine from "Image n" + subject description + plot; "Video n" for action, camera and effects; voice: `"Character" says: "line", voice timbre references "Audio n"`. Edit: add = what + when + where; delete = say what stays unchanged; modify = say what replaces what. Extend: "Extend Video n forward/backward + description"; fill-in: "Video 1 + transition + Video 2 + transition + Video 3". A prompt skill (`sd2-pe`) exists on their side.
- ECLIPSE SETUP FOR 2.0: no new code. Route = Config value `ROUTE_SEEDANCE_2_0=direct` with the Secret `ARK_API_KEY`; model id `dreamina-seedance-2-0-260128` (override `ARK_VIDEO_MODEL_SEEDANCE_2_0`). The direct prices in the registry are still the older estimates (8% to 16% below BytePlus' real list, no direct 4k row): the owner decides whether to update them.
