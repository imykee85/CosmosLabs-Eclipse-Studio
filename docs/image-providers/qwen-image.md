# Qwen Image (Alibaba Cloud Model Studio) reference for Eclipse
Copied by Claude on 2026-10-20 from the official pages, summarised, not guessed. Sources:
- https://www.alibabacloud.com/help/en/model-studio/qwen-image-generation-and-editing-api-reference (3.0 and 2.1 series, generation AND editing)
- https://www.alibabacloud.com/help/en/model-studio/qwen-image-api (2.0 series text-to-image)
- https://www.alibabacloud.com/help/en/model-studio/qwen-image-edit-api (2.0 series editing)
Items marked NOT ON PAGE must be treated as unknown. Do not fill them in from memory.

(The owner pasted this file on 2026-10-20; it is kept here word for word. Eclipse's own notes on what was built from it are at the end.)

## Region, endpoint, key
- Use the SINGAPORE region. Model, endpoint and API key must all be from the same region; cross-region calls fail.
- Hosts use a workspace id: `https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com`. The page also says the older `dashscope-intl.aliyuncs.com` domain still works for Singapore. Make the workspace id a Config value (`DASHSCOPE_WORKSPACE_ID`) and keep the key in the existing Secret `DASHSCOPE_API_KEY`. Confirm with the owner which host form his account uses.
- Headers: `Content-Type: application/json`, `Authorization: Bearer <key>`. Async create also needs `X-DashScope-Async: enable`.

## Models (3.0 / 2.1 reference page)
`qwen-image-3.0-pro`, `qwen-image-3.0`, `qwen-image-2.1-pro`, `qwen-image-2.1-turbo`. The older 2.0 series (`qwen-image-2.0`, `qwen-image-2.0-pro` and dated versions) is on the other two pages. Eclipse's "Qwen Image 3" maps to `qwen-image-3.0` (cheaper) or `qwen-image-3.0-pro`; NOT ON PAGE: which one the owner wants, and the per-image prices (pricing page was too long to read; owner to screenshot Model Studio pricing for these models, Singapore).

## Endpoints
- DashScope sync (recommended): `POST /api/v1/services/aigc/multimodal-generation/generation`
- DashScope async create: `POST /api/v1/services/aigc/image-generation/generation` (the 2.0 page shows `/api/v1/services/aigc/text2image/image-synthesis` for older models; use the one on the 3.0 page for 3.0)
- Async poll: `GET /api/v1/tasks/{task_id}` (valid 24 hours; same region, workspace and key)
- OpenAI-compatible: `POST /compatible-mode/v1/images/generations` (sync only; NO `/images/edits`, no masks, no streaming, no multipart)

## Request (DashScope sync and async)
```
{ "model": "qwen-image-3.0",
  "input": { "messages": [ { "role": "user", "content": [ {"text": "prompt"} ] } ] },
  "parameters": { "n": 1, "size": "1024*1024", "seed": 123,
                  "negative_prompt": "...", "prompt_extend": true,
                  "prompt_extend_mode": "direct", "enable_thinking": true, "watermark": false } }
```
- `messages`: exactly ONE element, role `user`. Text-to-image: one `{"text": ...}` object. Image edit: 1 to 3 image objects (`{"image": url-or-base64}`) for 3.0 (1 to 10 for 2.1) followed by exactly ONE text object.
- `n` 1 to 6 (integer). `size` uses an ASTERISK in DashScope (`1024*1024`) and `x` in OpenAI mode. If `size` is omitted the model picks one from the prompt.
- Output area must be between 512*512 and 2048*2048 total pixels, aspect ratio between 1:8 and 8:1. Output is PNG.
- `negative_prompt`: 3.0 series only. `prompt_extend_mode`: `direct` or `agent` (agent is text-to-image only; edit returns 400). `enable_thinking` needs `prompt_extend=true`. Defaults: prompt_extend true, watermark false.
- Prompt: recommended maximum 4,500 tokens.
- Input images: public HTTP/HTTPS URL or `data:{mime};base64,...`; JPG, JPEG, PNG, BMP, TIFF, WEBP, GIF; each side 1 to 8000 px (best 384 to 2048); longest/shortest side at most 10:1; at most 10 MB each.

## Response
- Sync: `output.choices[0].message.content[].image` = PNG URL (expires after 24 hours: download to R2 immediately), `output.usage`, `request_id`. Error: `code`, `message`, `request_id`.
- Async create: `output.task_id`, `output.task_status` = PENDING. Poll `task_status`: PENDING, RUNNING, SUCCEEDED, FAILED, CANCELED, UNKNOWN. Success has `output.choices`, failure has `output.code` and `output.message`.
- Billing tiers visible in OpenAI-mode usage: 1k or 2k by whether output area is at or below 2,250,000 pixels. This is why Eclipse prices 1k and 2k separately. Failed calls are not billed (2.0 page: each successfully generated image is billed).

## NOT ON PAGE (do not guess)
Prices; rate limits and concurrency; error-code list (separate page); recommended polling interval (2.0 page suggests about 5 to 10 seconds); whether 3.0 and 2.1 use different `rewrite_status` values.

## What Eclipse built from this page (2026-10-20)
- `src/lib/providers/qwen.ts`: the DashScope SYNC call, one picture per request (`n` 1), size written with an asterisk, the PNG downloaded at once (the link lasts 24 hours). Nothing else on this page is used (no async, no OpenAI-compatible mode, no negative prompt, no thinking, no seed).
- Model id: Config value `QWEN_IMAGE_MODEL`, default `qwen-image-3.0` (the cheaper one; the owner has not said which he wants). Host: Config `DASHSCOPE_WORKSPACE_ID` if set, else the older `dashscope-intl.aliyuncs.com` that the page says still works; `DASHSCOPE_BASE_URL` replaces both (tests).
- Sizes: 1k = about 1,048,576 pixels, 2k = about 4,000,000 pixels (just under the 4,194,304 limit, above the 2,250,000 billing line), both rounded to multiples of 16 and pulled inside 512*512 to 2048*2048. Rounding to 16 is Eclipse's own safe choice, not stated on the page.
- `prompt_extend` is sent as false (the person's words are used as written) and `watermark` as false. The page says prompt extension defaults to true; whether it costs extra is NOT ON PAGE.
- Route: `ROUTE_QWEN_IMAGE_3=direct` and `ROUTE_QWEN_IMAGE_3_EDIT=direct` (Config), with `DASHSCOPE_API_KEY` (Secret). Direct price: $0.0248 a picture at 1k and 2k, from the owner's pricing brief (NOT confirmed on this page).
- If the direct call cannot reach the provider, is refused for key or rate reasons, or times out, the render falls back to Higgsfield at the Higgsfield price. A content refusal or a failed picture does NOT fall back.
