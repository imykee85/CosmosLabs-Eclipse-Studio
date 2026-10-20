# Eclipse prices

**The only source is `docs/eclipse-PRICING-MASTER-brief.md` (owner, 2026-10-20).** It replaces `eclipse-pricing-brief.md`, the "Eclipse: real prices (CC brief)" and every earlier price anywhere in the repo or CLAUDE.md. This file only says where each part lives in the code and how far the build has got; it does not restate prices. The owner's workbook `eclipse-pricing-model.xlsx` has the formulas.

## Rule in one paragraph
A credit is worth $0.10. The ledger counts in TENTHS of a credit (`LEDGER_UNITS_PER_CREDIT = 10`, `src/lib/credit-units.ts`); people see `fmtCredits(units)` ("1", "187.4"). Images and sound/chat/audio use a 2.5x markup, video 1.8x (master brief section 1). Provider LIST prices only, never Higgsfield promotions. Free trial: 2 free image generations, nothing else free, then the subscription alert (below).

## Build status by batch (master brief section 13)
| Batch | Code | Status |
|---|---|---|
| 1. Units and plans | `credit-units.ts`, `plans.ts`, `plan-copy.ts`, `subscribe-alert.ts`, `SubscribeAlert.tsx`, Billing and landing copy | built |
| 2. Image prices | `usd` per resolution in `models.ts`, `imageCredits`, `chargeFor`, Soul batch (`batchId`), GPT Image 1 off | built earlier (PR #58); checked against section 4 in batch 2 |
| 3. Video prices | `price.usd` in `video-models.ts`, `videoCredits` | NOT to the master brief yet: still the earlier 2.5x rule (`/ $0.04`), batch 3 moves it to 1.8x with `VIDEO_MARGIN` and `VIDEO_CREDIT_USD` |
| 4. Anthropic (Auto to Sonnet, caching, trimming) | `connect-models.ts`, `chat-credits.ts`, `connect-agent.ts`, `agent/chat` | not started |
| 5. Audio config | `AUDIO_MARGIN`, `AUDIO_CREDIT_USD` | defaults already 2.5 and 0.01; display check in batch 5 |
| 6. Direct routes | `src/lib/routes.ts` | switch, prices and fallback exist against a fake provider; no real provider |
| 7. `/admin/pricing` | `price-table.ts`, `app/(account)/admin/pricing` | exists from PR #58; redone to the master brief in batch 7 |
| 8. Hardening | | not started |

## Plans, packs, trial (batch 1)
Plans (`plans.ts`, ledger units): Starter $19 = 2,000, Growth $49 = 6,000, Scale $199 = 25,000 (shown 200, 600, 2,500); seats 1, 3, 10. Packs: `topup_500` $6, `topup_2000` $22, `topup_6000` $60 (ledger 500, 2,000, 6,000; shown 50, 200, 600; the 600 pack carries "Best value"). Custom amount: whole credits, from the first amount that reaches $9 up to the biggest pack. **Owner step:** the three Whop top-up plans (`WHOP_PLAN_TOPUP_500|2000|6000`) must be $6, $22 and $60.
Plan cards show the value line "≈ 200 images or 12 Kling videos" (600: 37, 2,500: 156; Kling 3.0 Pro 5 s with sound = 16 credits at the video price of batch 3), Growth is the larger "Most popular" card, Growth shows "Save 14%" and Scale "Save 16%".

**Free trial.** `FREE_RENDERS_COUNT` (2) image renders on any image model at the default resolution, claimed in `startRender` (`free-renders.ts`), given back if the render fails, never touching the balance; `FREE_RENDERS_FROM` and the one-account barrier stay; `FREE_RENDERS_MAX_CREDITS` is ignored; no credits are granted at sign-up. **Subscription alert** (`subscribe-alert.ts`): when an image, video, audio or chat request cannot be paid and the account has no active subscription, the API answers 402 with `code: "SUBSCRIBE"` and "You've used your 2 free images. Subscribe to keep creating." (accounts that never had the trial: "Subscribe to keep creating."; saved but locked top-up credits keep their own sentence and also carry the code). `SubscribeAlert.tsx` (root layout) sees every such answer and opens one dialog with a Subscribe button to Settings > Billing. Accounts that hold credits (owner grants, testers, purchases) are not blocked: the alert only replaces the "needs N credits" sentence when the request could not be paid.

## Direct routes (`src/lib/routes.ts`, batch 6)
`ROUTE_<MODEL_ID>=direct|higgsfield` (Config, default higgsfield). Direct is used only with the setting, the maker's key AND a registered adapter; no real adapter exists (the reference files in master brief section 10 are not attached), so everything runs and is priced on Higgsfield.

## Not verified
Master brief section 15 is the list. Nothing in it has been measured by this code.
