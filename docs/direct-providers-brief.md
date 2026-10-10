# Eclipse: Nano Banana, GPT Image and Seedream, called directly (updated 2026-10-09)

Status: ALL THREE PROVIDERS ARE BUILT AND PUSHED (commits 3af48d6 and 0135c76 on `claude/new-session-1h84ct`). Nothing has run against a live provider (no keys; the sandbox cannot reach them). Every new model is `enabled: false` in `src/lib/models.ts` and hidden while its key is missing. Tested against fake Google, OpenAI, BytePlus and R2 servers plus a throwaway database: row written first, picture decoded, saved to R2, row completed; a model that is not enabled is refused.

## How it works
- Google, OpenAI and BytePlus answer in the same call, so the render runs INSIDE `POST /api/generate` (`maxDuration = 60`, 55 s cap) via `runInline` in `src/lib/start-render.ts`. Higgsfield stays a job to poll.
- Own double-submit protection: the Generation row is written first as `pending` with `statusUrl "sync:<jobId>"`. A request that died leaves a row that `finalizeGeneration` marks failed after 4 minutes. Nothing is re-submitted after a timeout.
- Pictures are decoded (Google base64, OpenAI `b64_json`, BytePlus `b64_json` requested, so no 24-hour link) and saved to private R2. R2 must be set up; there is no provider link to fall back on.
- Rows store model, provider, `providerUsage`; no seed is sent to any of these. Costs are unknown (`estimatedCostUsd` null) until measured.
- Orbit's assistant lists and uses Higgsfield models only (a sync render would outlast its 48 s turn).
- The picker has Google, GPT and Seedream groups; Popular shows the real rows for Nano Banana 2.1, GPT 2.5 Sunburst and Seedream 5 Pro once they are enabled.
- Schema change: `Generation.provider`, `providerUsage` (check `db-push: applying` in the build log of commit 3af48d6).

## Models in the registry (all disabled)
| Family | Ids | Provider model ids |
|---|---|---|
| Google | `nano_banana_2_1`, `nano_banana_2_lite`, `nano_banana_2`, `nano_banana_pro`, `nano_banana` | gemini-nano-banana-2.1, gemini-3.1-flash-lite-image, gemini-3.1-flash-image, gemini-3-pro-image, gemini-2.5-flash-image |
| OpenAI | `gpt_image_2_5_sunburst`, `_2_5_flare`, `gpt_image_2`, `_1_5`, `_1`, `_1_mini` | gpt-image-2.5-sunburst, gpt-image-2.5-flare, gpt-image-2, gpt-image-1.5, gpt-image-1, gpt-image-1-mini |
| BytePlus | `seedream_5_pro`, `_5_flash`, `_5_lite`, `_4_5`, `_4` | UNCONFIRMED (third-party list; 5.0 flash has none): set `ARK_MODEL_<ID>` |

## Known guesses (kept honest in the code)
- Google: the reply shape is read tolerantly (`output_image` or the last image block outside "thought" steps). Aspect ratios are provisional. No thinking-level UI. Reference types (object/character/style) are not split.
- OpenAI: quality is sent as `medium` until costs are measured. `/images/edits` is used when pictures are attached. Newest models may need organisation verification.
- BytePlus: auth header assumed `Authorization: Bearer`. Only the 5.0 Pro 2K size row is from the page; other sizes are computed (same area, multiples of 16, inside the documented pixel ranges). `output_format: png` is sent only to 5.0 Pro, Flash and Lite. Watermark is sent as false.

## What is still needed from the owner
1. BytePlus pages: "Base URL and authentication" (confirm the header), the real model ids from the console's Model List (esp. 5.0 flash), and the size tables in `attachment.txt`.
2. Google: aspect-ratio list per model, request size limits, whether a seed exists.
3. Keys, all Secrets (Production and Preview, then redeploy): `GEMINI_API_KEY` (billing on), `OPENAI_API_KEY` (check organisation verification for GPT 2.5), `ARK_API_KEY` (activate each model in the BytePlus console).
4. Config values: `ARK_MODEL_<ID>` per Seedream model, then `ENABLED_MODELS=id,id` only after one cheap live render per model works (suggested first: `nano_banana_2_lite`, `gpt_image_1_mini`, `seedream_4`). Report time, cost and any error text.
5. Leftovers: Anthropic credit for Orbit, Soul Cinema retry text, live seed tests (Z-Image Turbo, then Soul 2), the remaining Image Studio items.

Owner confirmed on 2026-10-10 that their part (keys and settings in Vercel) is done; a redeploy was pushed so the new variables apply. Next: one cheap live render per model, then ENABLED_MODELS.
