# Eclipse prices (owner decision 2026-10-20)

The owner's workbook `eclipse-pricing-model.xlsx` has every number with formulas and sources. This file is the rule and where each part lives in the code.

## The rule behind every number
- One credit is worth **$0.10** to the customer and pays for **$0.04 of provider cost** (a 2.5x markup). The ledger counts in **tenths** of a credit (`LEDGER_UNITS_PER_CREDIT = 10`, `src/lib/credit-units.ts`); people always see `tenths / 10` (a whole number when whole, else one decimal: 1874 shows as 187.4). Everything the server adds up (balances, holds, charges, plan grants) is in ledger units; only text a person reads is in credits (`fmtCredits`).
- **Images**: credits = `ceil(provider list cost / $0.04)`, at least 1, per model and resolution (`usd` on each model in `src/lib/models.ts`, `imageCredits`). The price of the resolution actually sent is held when the render starts (saved on the row as `creditsHeld`) and charged when it finishes. **Soul 2 and Soul Cinema**: one credit pays for a batch of up to 4 images made in one Generate (the browser sends a batch id; the first request of the batch pays, the others are created with nothing held, counted under the per-person lock).
- **Video**: `ceil(seconds x cost per second / $0.04)` for the whole clip, rounded once (`docs/video-pricing.md`).
- **Audio, chat, transcription, sound, music**: `AUDIO_MARGIN` 2.5 and `AUDIO_CREDIT_USD` 0.01, `CHAT_MARGIN` 2.5 and `CHAT_CREDIT_USD` 0.01 (Config values; the defaults in code are these), charged in ledger units and shown with one decimal ("0.7 credits"). Sandbox: build 10 per 5 minutes (1 credit), tool run 5, sound merge 5.
- List prices only: the providers' own promotions are not used (extra margin while they last). Worst case (every credit used, international card fees) this gives about 46% to 54% gross margin on plans and 57% to 62% on top-up packs: `/admin/pricing` shows the margin of every row.

## Plans and packs (`src/lib/plans.ts`, ledger units; the Whop plan ids do not change)
| Plan | Price | Credits shown | Ledger | Seats |
|---|---|---|---|---|
| Starter | $19 | 200 | 2,000 | 1 |
| Growth | $49 | 600 | 6,000 | 3 |
| Scale | $199 | 2,500 | 25,000 | 10 |

| Pack (subscribers only) | Price | Credits shown | Ledger |
|---|---|---|---|
| `topup_500` | $6 | 50 | 500 |
| `topup_2000` | $22 | 200 | 2,000 |
| `topup_6000` | $60 | 600 | 6,000 |

A custom amount is whole credits only, at least $9 worth, at most the biggest pack, priced on the line through the packs. **Owner step:** the three Whop top-up plans (`WHOP_PLAN_TOPUP_500|2000|6000`) must be set to $6, $22 and $60: a pack's Whop price must match `plans.ts`.

## Free trial
A new account (made on or after `WELCOME_FROM`, default 2026-10-20) gets **10 free credits** (100 ledger units) once, as a plain `GRANT` ledger line (`src/lib/welcome-credits.ts`), usable on anything, in its own workspace only, while `CREDITS_ENABLED=1`. `WELCOME_CREDITS` (Config value) changes the amount, `0` ends the offer. `FREE_RENDERS_COUNT` and `FREE_RENDERS_MAX_CREDITS` no longer do anything (kept as names for one release); `FREE_RENDERS_FROM` is read as a fallback for `WELCOME_FROM`. The `free_renders` table is only a marker that Clerk was asked.

## Direct routes (`src/lib/routes.ts`)
`ROUTE_<MODEL_ID>=direct|higgsfield` (Config value, default `higgsfield`). A model uses its direct route only when the setting says so, its maker's key is set (`ARK_API_KEY`, `DASHSCOPE_API_KEY`, new Secret `XAI_API_KEY`) AND an adapter has been registered. **No adapter exists yet**: the request shapes are waiting for the owner's reference files (`docs/video-providers/byteplus-seedance.md`, `docs/image-providers/qwen-image.md`, `docs/image-providers/xai-imagine.md`) and are not built from memory, so every model runs and is priced on Higgsfield today. The credit price always follows the route a render really uses; when a direct start fails before the provider accepts the job it falls back to Higgsfield at the Higgsfield price (`startWithFallback`). Seedance 2.0 (480/720/1080p) and 2.5, Qwen Image 3 and Edit, and Grok Image 2.0 at 2k have direct prices; Kling direct is not planned (it needs prepaid Kling packages).

## What people see
Pickers and Generate show the small number first ("from 4 credits", "4 images · 1 credit"; video "from 18 credits"), plan cards show a value line ("≈ 200 images or 9 Kling videos", from `src/lib/plan-copy.ts`, the yardstick is Kling 3.0 Pro, 5 s, sound on = 21 credits), Growth is the larger "Most popular" card, "Save 14%" on Growth and "Save 16%" on Scale (price per credit against Starter). Provider dollar costs are never shown to users.

## Not verified (marked "Estimate" in the workbook)
Soul Cinema 1080p, Marketing Studio 4k low and Flare/Sunburst, Grok Image 2 at 2k low, Nano Banana 2 Lite, GPT Image 2.5 and GPT Image 2 at 2k, Seedream 5.0 Pro 2k and 5.0 Flash, Kling 3.0 4K and Standard with sound, Wan 3.0 Prime 720p and 1080p, Kling 2.6 Motion Control, and the direct Seedance prices. Confirm each with one real render and the provider bill. Flare/Sunburst 4k and Seedream 5.0 Flash 1k are not in the workbook; they reuse Marketing Studio Image 4k and the Flash 2k cost until measured.
No price-estimate request for Higgsfield is saved in `docs/`, so the price check page does not call one.
