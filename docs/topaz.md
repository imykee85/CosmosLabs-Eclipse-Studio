# Upscale (Topaz Labs API)

Built 2026-11-05 from the owner's docs pack. Code: `src/lib/topaz/` (`models.ts` pure presets, sizes and prices; `client.ts` fetch with `X-API-Key` and a custom User-Agent, retries 425/429/5xx; `jobs.ts` start, status adapters), routes `POST /api/upscale` and `/api/upscale/quote`, panel `src/components/upscale/UpscalePanel.tsx` (Image Studio tray and Video Studio tray). Official docs: https://developer.topazlabs.com (append `.md`), index `llms.txt`, corpus `llms-full.txt`. Base `https://api.topazlabs.com`; limits: 429 back off, request cap 500 MB.

## Settings
- `TOPAZ_API_KEY` (Secret). `TOPAZ_CREDIT_USD` (Config value): dollars per Topaz credit on the owner's plan; NOT guessed, Upscale stays off until it is set. `TOPAZ_BASE_URL` optional.
- Eclipse price = Topaz credits x `TOPAZ_CREDIT_USD`, then `creditsForUsd` (at cost, rounded up to the cent), only with `CREDITS_ENABLED=1`.

## How it runs
The result is a NEW Generation row (`model: "upscale"`, `provider: "topaz"`, `params.upscaleOf`), price held at start, `statusUrl` `topaz:image:<process_id>` or `topaz:video:<requestId>` (`topaz:<kind>:pending` until the maker answers). `higgsfield.status` and `videoStatus` hand those addresses to `topazImageStatus` / `topazVideoStatus`, so the ordinary finish code polls, copies the file into private storage, charges once and completes. Failures are plain text; the maker's reply goes to the logs only. People see Auto / Faithful / Creative, never the maker's names.

IMAGE: multipart `POST /image/v1/enhance-gen/async` (Auto = `Wonder 4`, Creative = `Bloom 2` with `creativity` 1 to 9, `autoprompt`, `colorPreservation`) or `/image/v1/enhance/async` (Faithful = `Upscale High Fidelity V3`), fields `model`, `output_format=jpeg`, `output_width`, `output_height`, `image`; then `GET /image/v1/status/{id}` until Completed, `GET /image/v1/download/{id}` -> `download_url`. Sizes 2x and 4x (max 256 MP, 32000 px a side). Credits = ceil(output MP / 8) Auto, /24 Faithful, /2 Creative.

CLIP: `POST /video/` JSON (`source`, `output` H264 mp4 up to 4096 px, `filters`: Auto `slp-2.6`, Faithful `prob-4`, Creative `ast-2`) -> `requestId` (+ estimate) -> `PATCH /video/{id}/accept` -> `urls` -> PUT the file (split equally over several urls) -> `PATCH /video/{id}/complete-upload` `{uploadResults:[{partNum,eTag}]}` -> poll `GET /video/{id}/status` -> `download.url`. Output 1080p or 4K (only larger than the source, multiples of 4). Credits: Auto frames / 26.0417 (1080p) or 11.9179 (4K); Creative frames / 10 or 6; Faithful 2 per gigapixel at the next scale step. The file credit (1 per GiB output) is not added locally (the docs' examples leave it out); if the maker's own estimate is above ours x 1.2 + 1 nothing is accepted and the row fails with nothing charged.

## NOT VERIFIED (read defensively, check with the first real run)
Status words and field names (`status`, `download.url`, `download_url`), the shape of `source`/`output.resolution`, where the estimate sits in the create answer, how many upload parts the maker returns and how they are sized, the real credit price of a dollar, the clip source frame rate (read by mediabunny, 24 when unknown), Face Recovery 3 / Recover 3 / Redefine / Starlight Precise 2.5 and Fast 3 parameters, the webhook shape and rate-limit numbers. Sources over 250 MB are refused (sent through the server in one piece).

Tests: `tests/unit/topaz.test.ts` (every row of the docs' price tables, sizes, forms), `tests/integration/topaz-upscale.test.ts` (fake Topaz + fake R2 + Postgres: request fields, hold, polling, save, single charge, failure, refusals), `tests/e2e/upscale.spec.ts` (both panels).
