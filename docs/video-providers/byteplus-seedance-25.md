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
