# Eclipse prices

**The only source is `docs/eclipse-PRICING-MASTER-brief.md` (owner, 2026-10-20).** It replaces `eclipse-pricing-brief.md`, the "Eclipse: real prices (CC brief)" and every earlier price anywhere in the repo or CLAUDE.md. This file only says where each part lives in the code and how far the build has got; it does not restate prices. The owner's workbook `eclipse-pricing-model.xlsx` has the formulas.

## Rule in one paragraph
A credit is worth $0.10. The ledger counts in TENTHS of a credit (`LEDGER_UNITS_PER_CREDIT = 10`, `src/lib/credit-units.ts`); people see `fmtCredits(units)` ("1", "187.4"). Images and sound/chat/audio use a 2.5x markup, video 1.8x (master brief section 1). Provider LIST prices only, never Higgsfield promotions. Free trial: 2 free image generations, nothing else free, then the subscription alert (below).

## Build status by batch (master brief section 13)
| Batch | Code | Status |
|---|---|---|
| 1. Units and plans | `credit-units.ts`, `plans.ts`, `plan-copy.ts`, `subscribe-alert.ts`, `SubscribeAlert.tsx`, Billing and landing copy | built |
| 2. Image prices | `usd` per resolution in `models.ts`, `imageCredits`, `chargeFor`, Soul batch (`batchId`), GPT Image 1 off | built earlier (PR #58); every row of section 4 asserted in batch 2 |
| 3. Video prices | `price.usd` in `video-models.ts`, `videoCredits` | built: 1.8x with `VIDEO_MARGIN` / `VIDEO_CREDIT_USD`, every row of section 5 asserted for 5 s and 4 s, daily cap and confirm defaults now in credits (5000 / 500) |
| 4. Anthropic (Auto to Sonnet, caching, trimming) | `connect-models.ts`, `chat-credits.ts`, `connect-agent.ts`, `agent/chat` | built: Auto = Sonnet (Max stays Opus with a credits note), Sonnet cache read $0.10, `src/lib/prompt-cache.ts` (breakpoints on system+tools and on the last history block, old pictures and big tool results shortened in what is SENT), used by Core's loop and Atlas/agent chat; Treatment, Prompts and the one-shot Haiku calls are not cached (see report) |
| 5. Audio config | `AUDIO_MARGIN`, `AUDIO_CREDIT_USD` | defaults already 2.5 and 0.01; display check in batch 5 |
| 6. Direct routes | `src/lib/routes.ts` | switch, prices and fallback exist against a fake provider; no real provider |
| 7. `/admin/pricing` | `price-table.ts`, `app/(account)/admin/pricing` | exists from PR #58; redone to the master brief in batch 7 |
| 8. Hardening | | not started |

## Plans, packs, trial (batch 1)
Plans (`plans.ts`, ledger units): Starter $19 = 2,000, Growth $49 = 6,000, Scale $199 = 25,000 (shown 200, 600, 2,500); seats 1, 3, 10. Packs: `topup_500` $6, `topup_2000` $22, `topup_6000` $60 (ledger 500, 2,000, 6,000; shown 50, 200, 600; the 600 pack carries "Best value"). Custom amount: whole credits, from the first amount that reaches $9 up to the biggest pack. **Owner step:** the three Whop top-up plans (`WHOP_PLAN_TOPUP_500|2000|6000`) must be $6, $22 and $60.
Plan cards show the value line "≈ 200 images or 12 Kling videos" (600: 37, 2,500: 156; Kling 3.0 Pro 5 s with sound = 16 credits at the video price of batch 3), Growth is the larger "Most popular" card, Growth shows "Save 14%" and Scale "Save 16%".

**Free trial.** `FREE_RENDERS_COUNT` (2) image renders on any image model at the default resolution, claimed in `startRender` (`free-renders.ts`), given back if the render fails, never touching the balance; `FREE_RENDERS_FROM` and the one-account barrier stay; `FREE_RENDERS_MAX_CREDITS` is ignored; no credits are granted at sign-up. **Subscription alert** (`subscribe-alert.ts`): when an image, video, audio or chat request cannot be paid and the account has no active subscription, the API answers 402 with `code: "SUBSCRIBE"` and "You've used your 2 free images. Subscribe to keep creating." (accounts that never had the trial: "Subscribe to keep creating."; saved but locked top-up credits keep their own sentence and also carry the code). `SubscribeAlert.tsx` (root layout) sees every such answer and opens one dialog with a Subscribe button to Settings > Billing. Accounts that hold credits (owner grants, testers, purchases) are not blocked: the alert only replaces the "needs N credits" sentence when the request could not be paid.

## Direct routes (`src/lib/routes.ts`, batch 6)
`ROUTE_<MODEL_ID>=direct|higgsfield` (Config, default higgsfield). Direct is used only with the setting, the maker's key AND a registered adapter; ONE real adapter exists: Qwen Image (`qwen_image_3`, `qwen_image_3_edit`), built 2026-10-20 from the owner's reference file `docs/image-providers/qwen-image.md` (`src/lib/providers/qwen.ts`: DashScope sync endpoint, Singapore, size `W*H`, `prompt_extend` false, no seed). Set `ROUTE_QWEN_IMAGE_3=direct` and `ROUTE_QWEN_IMAGE_3_EDIT=direct` (Config), `DASHSCOPE_API_KEY` (Secret), optional `QWEN_IMAGE_MODEL` (Config, default `qwen-image-3.0`) and `DASHSCOPE_WORKSPACE_ID` (Config; without it the `dashscope-intl` host is used). A direct render runs like Google/OpenAI ones (background, `waitUntil`) and is priced on the direct route; if the direct call fails for an infrastructure reason (unreachable, timeout, key refused, rate limit) the same row continues on Higgsfield at the Higgsfield price (hold raised when the balance allows, else the render fails with nothing charged); a safety refusal never falls back. Not verified live: the real API, the price ($0.0248 comes from the brief, not the page), 3.0 vs 3.0-pro. BytePlus Seedance and xAI have no adapter yet (reference files not attached), so they run and are priced on Higgsfield. Tests: `tests/unit/qwen.test.ts`, `tests/integration/qwen-route.test.ts`.

## Not verified
Master brief section 15 is the list. Nothing in it has been measured by this code.

## Credit expiry (owner addendum 2026-10-20, overrides "do not add expiry")
Plan credits renew monthly and do not roll over. Top-up credits last 90 days and can be used while you are subscribed.
- Code: `src/lib/expiry.ts` (pure `replayLedger`, `expireCredits`, `usersToExpire`), `src/lib/held.ts`, `unusable()` in `subscription.ts`, cron `/api/cron/expire-credits`.
- Nothing expires until the Config value `CREDIT_EXPIRY_START` (a date, e.g. `2026-11-20`) is set. Other Config values: `CREDIT_PLAN_DAYS` (default 33 = SUBSCRIPTION_DAYS: a month plus 3 days grace), `CREDIT_TOPUP_DAYS` (90), `CREDIT_EXPIRY_GRACE_DAYS` (7).
- Per-grant tracking is derived by replaying the append-only ledger (every positive row is a grant: source plan, top-up or other; what is left of it and its expiry are worked out in order). No new balance table, nothing to migrate or drift. Existing balances: a plan grant that existed before the start date expires at the later of its natural end and start + 7 days; a top-up bought before the start date expires 90 days after the start date; owner grants, refunds and test credits never expire.
- Spend order: plan credits (soonest expiry first), then credits that never expire, then top-up credits (oldest first). Expired credits are never spendable; a running job's hold stays valid (credits that expire while it runs still pay for it, and are removed after it settles).
- The expiry job writes one `EXPIRE` ledger row per expired grant (`expire:<grant ledger id>`, unique), so running it twice is the same as once.
