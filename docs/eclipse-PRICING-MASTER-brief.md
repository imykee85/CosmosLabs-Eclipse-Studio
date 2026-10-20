# Eclipse PRICING MASTER brief (2026-10-20)

This is the ONE file to build the new pricing from. It replaces every earlier pricing brief (`eclipse-pricing-brief.md` and anything about prices in other briefs). You cannot open links: everything you need is here. The owner's workbook `eclipse-pricing-model.xlsx` has the same numbers with live formulas and sources.

Owner = Mike. Rules that apply to ALL of this work: keys never in code or chat; say Config value vs Secret; one phase per batch with green tests before the next; push per phase and merge per the standing rule; no Canvas or Agents changes; greyed-out chips for unsupported options; VERIFICATION REPORT format from `docs/engineering-rules.md`. Nothing here is to be guessed: where a fact is not verified it is listed in section 15, test it and report.

## 0. Decisions log (what the owner decided, and what is still a default)
| # | Decision | Status |
|---|---|---|
| 1 | Customer-facing credit is worth **$0.10** (two-figure prices) | Owner decided |
| 2 | Free trial = **2 free image generations, then a subscription alert**. No free credits | Owner decided |
| 3 | Video markup **1.8x**, images/audio/chat **2.5x** | Owner agreed ("1.8x") |
| 4 | Anthropic chat fix: **Auto = Sonnet, add prompt caching** | Owner agreed |
| 5 | Cheaper direct routes (Seedance via BytePlus, Qwen Image via Alibaba, Grok Image via xAI) | Owner agreed in principle; needs reference files (section 10) |
| 6 | Plans $19 / $49 / $199 with 200 / 600 / 2,500 credits; packs 50/$6, 200/$22, 600/$60 | Defaults recommended by Claude, owner agreed to the recommendation. Change in `plans.ts` only |
| 7 | Soul 2 and Soul Cinema: 4 images for 1 credit; chat, voice, sound charged in tenths of a credit | Defaults recommended by Claude |
| 8 | Display extras: Growth "Most popular", "Save 14%" / "Save 16%", 600 pack "Best value", value line on plan cards | Defaults recommended by Claude |

## 1. The pricing rule (the only formula)
- Ledger: the existing ledger unit becomes a **TENTH of a credit** (`LEDGER_UNITS_PER_CREDIT = 10`). Everything customers see is `tenths / 10`: a whole number when whole, otherwise one decimal (e.g. 187.4). Existing balances convert by display (10,000 units show as 1,000 credits). Do not migrate data.
- **Images:** credits = `ceil(provider list cost / ($0.10 / 2.5))` = `ceil(cost / $0.04)`, at least 1, per image, at the resolution actually sent.
- **Video:** credits = `ceil(seconds x cost per second x 1.8 / $0.10)` for the WHOLE clip. Round ONCE at the end, never per second. Config: `VIDEO_MARGIN=1.8`, `VIDEO_CREDIT_USD=0.10`.
- **Audio, sound effects, music, transcription, chat, sandbox:** charged in tenths: `ceil(cost x margin / $0.01)` tenths, at least 1 tenth. Config values stay per tenth: `AUDIO_MARGIN=2.5`, `AUDIO_CREDIT_USD=0.01`, `CHAT_MARGIN=2.5`, `CHAT_CREDIT_USD=0.01`.
- Provider cost = the provider's LIST price. Higgsfield's current 15 to 75% promotions are NOT used (extra margin while they last).
- Worst-case gross margin (every credit used, international card, Whop 6.2% + $0.30): images/audio/chat about 46 to 54% on plans and 57 to 62% on packs; video about 25 to 37% (Scale 25%, Growth 27%, Starter 37%). Never charge a price whose margin is below 20% without telling the owner.
- Why video is lower: customers compare video with Higgsfield, whose retail is about $0.05 to $0.06 per credit (a 4 s Seedance 2.5 clip at 1080p is 64 Higgsfield credits, about $3.20 to $3.80). At 1.8x through the BytePlus route we are within about 10 to 20% of that.

## 2. Plans, packs and free trial (`src/lib/plans.ts`, Whop, landing, Settings > Billing)
| Plan | Price | Credits (was) | Credits (NEW) | Seats |
|---|---|---|---|---|
| Starter | $19 | 1,000 | **200** | 1 |
| Growth | $49 | 5,000 | **600** | 3 |
| Scale | $199 | 25,000 | **2,500** | 10 |

| Top-up pack (subscribers only, as built) | Price (was) | Price (NEW) | Credits (NEW) |
|---|---|---|---|
| Small | $10 | **$6** | **50** |
| Medium | $34 | **$22** | **200** |
| Large | $84 | **$60** | **600** |
- Plan prices do not change, so the Whop plan ids stay. The owner changes the three Whop top-up plans to $6, $22 and $60 (a pack's Whop price must equal `plans.ts`). Report this as an owner step.
- Custom amount: whole credits, price from the line through the three packs (it recalculates). Keep `CUSTOM_MIN_USD` at $9.
- Plan grants to the ledger are in tenths: 2,000 / 6,000 / 25,000 (and packs 500 / 2,000 / 6,000). Auto top-up thresholds and caps are shown in credits, stored in tenths.
- **Free trial:** a new account gets **2 free image generations** (existing `FREE_RENDERS_COUNT` = 2, images only, any image model, default resolution) and NOTHING else free: no free video, voice, sound, chat, Atlas, Core, Treatment or tools. A free render is not charged and never touches the balance. After the second, the next attempt to generate anything (image, video, audio, chat) shows the SUBSCRIPTION ALERT: "You've used your 2 free images. Subscribe to keep creating." with a Subscribe button to the plan picker. Video, audio and chat on a free account show it at once. No credits are ever granted at sign-up. Keep the landing Trial card as it is (no number stated), the welcome pop-up and the Generate button's real count. Keep the abuse limits (one per account, rate limits, `FREE_RENDERS_FROM`). Worst-case cost of a trial is two renders at the default resolution (under $0.20 each).
- Top-up credits stay locked for unsubscribed accounts, as built. Do not add expiry.

## 3. Showing prices (pricing psychology)
- Credit numbers are small. Pickers and the Generate button show the price with the number first: "Seedance 2.5 · 21 credits", "Nano Banana Pro · 4 credits". Image models show "from N credits" by their cheapest resolution.
- Soul 2 and Soul Cinema show "4 images · 1 credit" (one credit covers a batch of up to 4; a single image is also 1 credit).
- Plan cards, under the credit number, a plain value line using models available TODAY: Starter "≈ 200 images or 12 Kling videos", Growth "≈ 600 images or 37 Kling videos", Scale "≈ 2,500 images or 156 Kling videos" (images at 1 credit; Kling 3.0 Pro 5 s with sound = 16 credits). Add a Seedance 2.5 line ONLY when the BytePlus route is live (5 s at 720p = 21 credits: 9 / 28 / 119 clips).
- Growth is the middle, larger card with a "Most popular" badge. Growth shows "Save 14%", Scale "Save 16%" (price per credit against Starter). The 600 pack shows "Best value".
- Never show provider dollar costs to users. The balance pill shows whole credits, one decimal only when fractional.
- Out-of-credits and locked-top-up messages keep their current wording with the new units.

## 4. Image prices (credits per image, 2.5x)
Replace the flat `creditCost` with a price per resolution tier (a model with no resolution field has one number); remove the `CREDITS` tiers object and its comment, and state the rule above. The Generate button, `createGenerationHeld`, `reservations.ts`, Canvas, Atlas and the free-render check must all use the price of the resolution actually sent. Each image in a batch is charged, except Soul 2 / Soul Cinema where a batch of up to 4 is 1 credit in total.

| Model | Setting | Provider cost ($) | Credits now | **NEW credits per image** | Confidence |
|---|---|---|---|---|---|
| Soul 2 | 720p | 0.0032 | 2 | **1 credit = 4 images** | Verified on provider page |
| Soul 2 | 1080p | 0.0057 | 2 | **1 credit = 4 images** | Verified on provider page |
| Soul | 720p | 0.0938 | 7 | **3** | Verified on provider page |
| Soul | 1080p | 0.1875 | 7 | **5** | Verified on provider page |
| Soul Cinema | 720p | 0.0032 | 7 | **1 credit = 4 images** | Third-party listing |
| Soul Cinema | 1080p | 0.0057 | 7 | **1 credit = 4 images** | Estimate, measure |
| Marketing Studio Image 2.0 | 1k, low | 0.0162 | 19 | **1** | Verified on provider page |
| Marketing Studio Image 2.0 | 2k, low | 0.0222 | 19 | **1** | Verified on provider page |
| Marketing Studio Image 2.0 | 4k, low | 0.1000 | 19 | **3** | Estimate, measure |
| Marketing Studio Flare / Sunburst | 1k, low | 0.0162 | 19 | **1** | Estimate, measure |
| Marketing Studio Flare / Sunburst | 2k, low | 0.0222 | 19 | **1** | Estimate, measure |
| Ads Studio | 1 concept | 0.1071 | 32 | **3** | Verified on provider page |
| Grok Image 2.0 | 1k, low | 0.0400 | 7 | **1** | Verified on provider page |
| Grok Image 2.0 | 2k, low | 0.0800 | 7 | **2** | Estimate, measure |
| Recraft V4.1 | 1k | 0.0350 | 7 | **1** | Verified on provider page |
| Recraft V4.1 Pro | 2k | 0.2100 | 19 | **6** | Verified on provider page |
| Recraft V4.1 Utility | 1k | 0.0350 | 7 | **1** | Verified on provider page |
| Recraft V4.1 Utility Pro | 2k | 0.2100 | 19 | **6** | Verified on provider page |
| Qwen Image 3 (and Edit) | 1k | 0.0400 | 7 | **1** | Verified on provider page |
| Qwen Image 3 (and Edit) | 2k | 0.0750 | 7 | **2** | Verified on provider page |
| Ideogram 4.0 | Turbo | 0.0300 | 7 | **1** | Verified on provider page |
| Z-Image Turbo | 1k or 2k | 0.0150 | 7 | **1** | Verified on provider page |
| Nano Banana 2.1 | 1k | 0.0336 | 19 | **1** | Third-party listing |
| Nano Banana 2.1 | 2k | 0.0504 | 19 | **2** | Third-party listing |
| Nano Banana 2.1 | 4k | 0.0756 | 19 | **2** | Third-party listing |
| Nano Banana 2 Lite | 1k | 0.0250 | 7 | **1** | Estimate, measure |
| Nano Banana 2 | 1k | 0.0670 | 19 | **2** | Third-party listing |
| Nano Banana 2 | 2k | 0.1010 | 19 | **3** | Third-party listing |
| Nano Banana 2 | 4k | 0.1510 | 19 | **4** | Third-party listing |
| Nano Banana Pro | 1k or 2k | 0.1340 | 32 | **4** | Third-party listing |
| Nano Banana Pro | 4k | 0.2400 | 32 | **6** | Third-party listing |
| Nano Banana | any | 0.0390 | 7 | **1** | Third-party listing |
| GPT Image 2.5 Sunburst / Flare | 1k, medium | 0.0600 | 32 | **2** | Estimate, measure |
| GPT Image 2.5 Sunburst / Flare | 2k, medium | 0.2000 | 32 | **5** | Estimate, measure |
| GPT Image 2 | 1k, medium | 0.0530 | 19 | **2** | Third-party listing |
| GPT Image 2 | 2k, medium | 0.2000 | 19 | **5** | Estimate, measure |
| GPT Image 1.5 | medium | 0.0510 | 19 | **2** | Third-party listing |
| GPT Image 1 | medium | 0.0630 | 19 | **2** | Third-party listing |
| GPT Image 1 mini | medium | 0.0165 | 7 | **1** | Third-party listing |
| Seedream 5.0 Pro | 1k | 0.0675 | 19 | **2** | Third-party listing |
| Seedream 5.0 Pro | 2k | 0.1000 | 19 | **3** | Estimate, measure |
| Seedream 5.0 Flash | 2k | 0.0350 | 7 | **1** | Estimate, measure |
| Seedream 5.0 Lite | 2k or 4k | 0.0350 | 7 | **1** | Third-party listing |
| Seedream 4.5 | 2k or 4k | 0.0400 | 19 | **1** | Third-party listing |
| Seedream 4.0 | 1k to 4k | 0.0300 | 7 | **1** | Third-party listing |

Notes:
- **GPT Image 1** retires at OpenAI on 2026-10-23: set `enabled: false` and hide it.
- Marketing Studio stays at quality `low`, Grok Image at `low`, GPT models at `medium` (prices assume these).
- Reference pictures add small input cost on Google/OpenAI/Ads Studio; covered by the markup. No separate charge.
- When the Qwen or Grok direct routes are on (section 10): Qwen Image 3 and Edit = 1 credit at 1k and 2k; Grok Image 2.0 = 1 credit at 2k.

## 5. Video prices (1.8x, via Higgsfield)
Replace `price.perSecond` and `audioFactor` in `src/lib/video-models.ts` with credits per second by resolution and a separate sound-on number (no factor). Where both columns match the provider does not price sound separately. Motion Control and Genjutsu are per second of the motion/source clip, as today. Rewrite `docs/video-pricing.md` from this table and drop the "provisional" wording in the UI. The clip price is computed as `ceil(seconds x credits per second)` once, and shown on the Generate button before running. The tables show the 5 s and 4 s clip; any other length uses the same formula. Seedance clips can be as short as 4 s: the duration picker for each model must take its minimum and maximum length from the model's own settings (`video-models.ts`), not from this file; if the minimum is not already 4 s for Seedance, report it as a finding and do not guess.

| Model | Setting | Cost/s sound off ($) | Cost/s sound on ($) | Credits/s off | Credits/s on | **5 s clip, sound on (credits)** | **4 s clip, sound on (credits)** | Confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Kling 3.0 Standard | 1080p | 0.0840 | 0.1260 | 1.51 | 2.27 | **12** | **10** | Verified on provider page |
| Kling 3.0 Pro | 1080p | 0.1120 | 0.1680 | 2.02 | 3.02 | **16** | **13** | Verified on provider page |
| Kling 3.0 4K | 4k | 0.4200 | 0.6300 | 7.56 | 11.34 | **57** | **46** | Estimate, measure |
| Kling 3.0 Turbo | 720p | 0.1120 | 0.1120 | 2.02 | 2.02 | **11** | **9** | Verified on provider page |
| Kling 3.0 Turbo | 1080p | 0.1400 | 0.1400 | 2.52 | 2.52 | **13** | **11** | Verified on provider page |
| Kling 2.6 Pro | 1080p | 0.0700 | 0.1400 | 1.26 | 2.52 | **13** | **11** | Verified on provider page |
| Kling 2.5 Turbo Pro | 1080p | 0.0700 | 0.0700 | 1.26 | 1.26 | **7** | **6** | Verified on provider page |
| Kling 2.5 Turbo Standard | 720p | 0.0420 | 0.0420 | 0.76 | 0.76 | **4** | **4** | Verified on provider page |
| Seedance 2.0 | 480p | 0.1407 | 0.1407 | 2.53 | 2.53 | **13** | **11** | Verified on provider page |
| Seedance 2.0 | 720p | 0.3024 | 0.3024 | 5.44 | 5.44 | **28** | **22** | Verified on provider page |
| Seedance 2.0 | 1080p | 0.6804 | 0.6804 | 12.25 | 12.25 | **62** | **49** | Verified on provider page |
| Seedance 2.0 | 4k | 1.5552 | 1.5552 | 27.99 | 27.99 | **140** | **112** | Verified on provider page |
| Seedance 2.5 | 480p | 0.2056 | 0.2056 | 3.70 | 3.70 | **19** | **15** | Verified on provider page |
| Seedance 2.5 | 720p | 0.4622 | 0.4622 | 8.32 | 8.32 | **42** | **34** | Verified on provider page |
| Seedance 2.5 | 1080p | 1.1372 | 1.1372 | 20.47 | 20.47 | **103** | **82** | Verified on provider page |
| Happy Horse 1.1 | 720p | 0.1400 | 0.1400 | 2.52 | 2.52 | **13** | **11** | Verified on provider page |
| Happy Horse 1.1 | 1080p | 0.1800 | 0.1800 | 3.24 | 3.24 | **17** | **13** | Verified on provider page |
| Happy Horse 1.0 | 720p | 0.1400 | 0.1400 | 2.52 | 2.52 | **13** | **11** | Verified on provider page |
| Happy Horse 1.0 | 1080p | 0.2800 | 0.2800 | 5.04 | 5.04 | **26** | **21** | Verified on provider page |
| Wan 3.0 | 480p | 0.0500 | 0.0500 | 0.90 | 0.90 | **5** | **4** | Verified on provider page |
| Wan 3.0 | 720p | 0.1000 | 0.1000 | 1.80 | 1.80 | **9** | **8** | Verified on provider page |
| Wan 3.0 | 1080p | 0.2000 | 0.2000 | 3.60 | 3.60 | **18** | **15** | Verified on provider page |
| Wan 3.0 Prime | 480p | 0.0680 | 0.0680 | 1.22 | 1.22 | **7** | **5** | Verified on provider page |
| Wan 3.0 Prime | 720p | 0.1400 | 0.1400 | 2.52 | 2.52 | **13** | **11** | Estimate, measure |
| Wan 3.0 Prime | 1080p | 0.2800 | 0.2800 | 5.04 | 5.04 | **26** | **21** | Estimate, measure |
| Wan 2.7 | 720p | 0.1000 | 0.1000 | 1.80 | 1.80 | **9** | **8** | Verified on provider page |
| Wan 2.7 | 1080p | 0.1500 | 0.1500 | 2.70 | 2.70 | **14** | **11** | Verified on provider page |
| Wan 2.6 | 720p | 0.1000 | 0.1000 | 1.80 | 1.80 | **9** | **8** | Verified on provider page |
| Wan 2.6 | 1080p | 0.1500 | 0.1500 | 2.70 | 2.70 | **14** | **11** | Verified on provider page |
| MiniMax H3 | 2K | 0.1300 | 0.1300 | 2.34 | 2.34 | **12** | **10** | Verified on provider page |
| Hailuo 2.3 Standard | 768p | 0.0560 | 0.0560 | 1.01 | 1.01 | **6** | **5** | Verified on provider page |
| LTX-2.5 Fast | 720p | 0.0900 | 0.0900 | 1.62 | 1.62 | **9** | **7** | Verified on provider page |
| LTX-2.5 Fast | 1080p | 0.1300 | 0.1300 | 2.34 | 2.34 | **12** | **10** | Verified on provider page |
| LTX-2.5 Fast | 2k | 0.1900 | 0.1900 | 3.42 | 3.42 | **18** | **14** | Verified on provider page |
| LTX-2.5 Fast | 4k | 0.3000 | 0.3000 | 5.40 | 5.40 | **27** | **22** | Verified on provider page |
| LTX-2.5 Pro | 720p | 0.1200 | 0.1200 | 2.16 | 2.16 | **11** | **9** | Verified on provider page |
| LTX-2.5 Pro | 1080p | 0.1700 | 0.1700 | 3.06 | 3.06 | **16** | **13** | Verified on provider page |
| Grok Video 1.5 | 480p | 0.0800 | 0.0800 | 1.44 | 1.44 | **8** | **6** | Verified on provider page |
| Grok Video 1.5 | 720p | 0.1400 | 0.1400 | 2.52 | 2.52 | **13** | **11** | Verified on provider page |
| Grok Video 1.5 | 1080p | 0.2500 | 0.2500 | 4.50 | 4.50 | **23** | **18** | Verified on provider page |
| Cinema Studio 4.0 | 480p | 0.2057 | 0.2057 | 3.70 | 3.70 | **19** | **15** | Verified on provider page |
| Cinema Studio 4.0 | 720p | 0.4623 | 0.4623 | 8.32 | 8.32 | **42** | **34** | Verified on provider page |
| PixVerse V6 | 360p | 0.0350 | 0.0350 | 0.63 | 0.63 | **4** | **3** | Verified on provider page |
| PixVerse V6 | 540p | 0.0450 | 0.0450 | 0.81 | 0.81 | **5** | **4** | Verified on provider page |
| PixVerse V6 | 720p | 0.0600 | 0.0600 | 1.08 | 1.08 | **6** | **5** | Verified on provider page |
| PixVerse V6 | 1080p | 0.1150 | 0.1150 | 2.07 | 2.07 | **11** | **9** | Verified on provider page |
| Kling 3.0 Motion Control Pro | per motion-clip second | 0.1680 | 0.1680 | 3.02 | 3.02 | **16** | **13** | Verified on provider page |
| Kling 3.0 Motion Control Standard | per motion-clip second | 0.1260 | 0.1260 | 2.27 | 2.27 | **12** | **10** | Verified on provider page |
| Kling 2.6 Motion Control Pro / Std | per motion-clip second | 0.1680 | 0.1680 | 3.02 | 3.02 | **16** | **13** | Estimate, measure |
| Genjutsu motion transfer | 480p, per source second | 0.3180 | 0.3180 | 5.72 | 5.72 | **29** | **23** | Verified on provider page |
| Genjutsu motion transfer | 720p | 0.6810 | 0.6810 | 12.26 | 12.26 | **62** | **50** | Verified on provider page |
| Genjutsu motion transfer | 1080p | 1.6320 | 1.6320 | 29.38 | 29.38 | **147** | **118** | Verified on provider page |

Raise the defaults `VIDEO_DAILY_CREDITS` to 5000 and `VIDEO_CONFIRM_CREDITS` to 500 (tenths are not involved: these are in credits): a single 5 s Seedance 2.0 1080p clip via Higgsfield is already 62 credits and a 4k clip 140, so the old values would block or nag on normal use. Confirm the unit these two settings use in the code (credits or ledger units) and scale accordingly.

## 6. Seedance through BytePlus (direct route, 1.8x)
When the route is on, Seedance 2.0 (480p to 1080p) and Seedance 2.5 use these prices. Seedance 2.0 at 4k stays on Higgsfield. Cost is estimated from BytePlus' per-token price (see section 15 item 2) and must be re-checked by the owner in the BytePlus console.

| Model | Setting | Direct cost/s ($) | Credits/s (exact) | 5 s clip | 4 s clip |
|---|---|---|---|---|---|
| Seedance 2.0 | 480p | 0.0643 | 1.16 | **6** | **5** |
| Seedance 2.0 | 720p | 0.1382 | 2.49 | **13** | **10** |
| Seedance 2.0 | 1080p | 0.3110 | 5.60 | **28** | **23** |
| Seedance 2.5 | 480p | 0.1075 | 1.94 | **10** | **8** |
| Seedance 2.5 | 720p | 0.2311 | 4.16 | **21** | **17** |
| Seedance 2.5 | 1080p | 0.5686 | 10.23 | **52** | **41** |

Customer comparison for the 4 s clip at 1080p with Seedance 2.5: Higgsfield app about $3.20 to $3.80; Eclipse via BytePlus = 41 credits = $4.10; Eclipse via Higgsfield = 82 credits = $8.20 (use the BytePlus route).

## 7. Audio, sound, music, transcription (tenths of a credit, 2.5x)
Prices are computed by the existing `creditsFor` with `AUDIO_MARGIN=2.5` and `AUDIO_CREDIT_USD=0.01` (tenths). Examples at the new settings, shown to the user in credits with one decimal:
| Item | Provider cost | Credits |
|---|---|---|
| ElevenLabs Eleven v4 / v3 / Multilingual v2, per 1,000 characters | $0.08 | 2.0 |
| ElevenLabs Turbo v4 / Flash v2.5, per 1,000 characters | $0.04 | 1.0 |
| Fish S2.1 Pro / S2 Pro, per 1,000 bytes | $0.015 | 0.4 |
| MiniMax Speech HD, per 1,000 characters | $0.10 | 2.5 |
| MiniMax Speech Turbo, per 1,000 characters | $0.06 | 1.5 |
| Qwen3 TTS Flash, per 1,000 characters | $0.01 | 0.3 |
| Seed Audio 1.0, per 60 s | $0.158 | 4.0 |
| ElevenLabs Sound Effects, per 10 s | $0.02 | 0.5 |
| ElevenLabs Music, per 60 s | $0.15 | 3.8 |
| Mirelo SFX 2.0, per 10 s per variant (list; promo $0.010/s to 2026-12-12 gives 2.6) | $0.15 | 3.8 |
| Scribe v2 transcription, per 10 minutes | $0.037 | 1.0 |
| Fish Transcribe 1 Pro, per 10 minutes | $0.060 | 1.5 |
| MiniMax ASR 1.0, per 10 minutes | $0.063 | 1.6 |
Use the registry's own prices (`src/lib/audio/registry.ts`), only the two Config defaults change. The Fish free model `s2.1-pro-free` ends 2026-11-30.

## 8. Anthropic: the main provider for Atlas, Core, Treatment and Prompts
**Provider:** Anthropic, one `ANTHROPIC_API_KEY`. List prices per million tokens (input / output / cache read / cache write 5 min): Opus 5.5 $4 / $20 / $0.20 / $5; Sonnet 5.5 $2 / $10 / $0.10 / $2.50 (cache read was $0.20 until a recent cut: confirm); Haiku 5.5 $0.10 / $0.50 / $0.01 / $0.125 (rates change above 100K tokens: $0.50 / $2.50). Thinking tokens bill as output.

**What runs where (today):**
| Feature | File | Model |
|---|---|---|
| Core | `connect-agent.ts` | picker: Auto, Eclipse Max (Opus), Pro (Sonnet), Lite (Haiku) |
| Atlas | `app/api/agent/chat` | Sonnet 5.5 |
| Treatment | `app/api/treatment/chat` | Sonnet 5.5 |
| Prompts chat | `app/api/prompts/chat` | Sonnet 5.5 |
| Polish prompt, memory extract, translate, upload scan | various | Haiku 5.5 |

**Fix 1: Auto must be Sonnet.** In `connect-models.ts`, `auto` currently maps to `claude-opus-5-5`, the dearest model, so every default Core message pays Opus rates. Set Auto to `claude-sonnet-5-5`. Keep "Eclipse Max" (Opus) as an opt-in with a note "uses more credits". Show each model's rough price in the picker (Lite "tiny", Pro "standard", Max "about 2x Pro"). Keep the server-side fallback beta as is. Update `PRICES` in `chat-credits.ts`: Sonnet `cacheRead: 0.10` (was 0.20; verify). Keep UNKNOWN as the dearest Opus row.

**Fix 2: prompt caching (the biggest saving).** There is no `cache_control` anywhere in `src/` today, so each step of a tool loop re-pays the full system prompt, 23 tool definitions and the whole chat history at full input price. Add caching to `connect-agent.ts` (steps loop) and `agent/chat` (the Atlas loop); Treatment and Prompts too when their system prompts are over the model's minimum cacheable size:
1. Put `cache_control: { type: "ephemeral" }` on the LAST block of `system` (system + tools are then cached together), keeping `SYSTEM` and `BRAND_RULE` byte-identical between calls: no timestamps, names or ids inside them.
2. Put a second breakpoint on the LAST content block of the LAST message before each call (move it forward every step), so the growing history is read from cache.
3. At most 4 breakpoints per request. Default cache lifetime is 5 minutes and refreshes on every hit; do not use the 1-hour option (it costs more to write).
4. Metering: `ChatMeter` must count `usage.cache_read_input_tokens` and `usage.cache_creation_input_tokens` at the cache prices (the PRICES table already has the columns; confirm `meter.add` reads them, and fix it if not). Never bill a cache read at the input price.
5. Cache writes cost 1.25x input and reads 0.1x or less, so caching only pays when the same prefix is used again within 5 minutes. A step loop always does. A one-off single message does not: skip caching for Polish, memory extract, translate and upload scan.
6. Test that the first step writes the cache and steps 2 to 8 read it, and that credits charged fall accordingly. Check the prompt is above the model's minimum cacheable length (NOT VERIFIED for the 5.5 models: read it from the Anthropic docs the owner attaches, `docs/anthropic-caching.md`).
7. Check that the `server-side-fallback` beta and caching work together (NOT VERIFIED). If the fallback swaps the model mid-request the cache will miss that call only.

**Fix 3 (optional, same batch if small): keep history from growing without bound.** `MAX_CHAT_MESSAGES = 120` and history is never trimmed, so a long chat sends 100k+ tokens every step. After a turn completes, replace image blocks older than the last two turns with the text "[picture omitted]", and replace old large tool results (over 4,000 characters) with their first 500 characters plus "[shortened]". Never alter the last two turns. The user's saved chat is untouched; only what is sent to the model changes.

**Estimated cost per message (estimates, measure with `/admin/health`):**
| | Short Core message (2 steps, 13k in / 1k out) | Long Core chat (3 steps, 100k in / 1.5k out) |
|---|---|---|
| Opus, today | $0.072 = 1.8 credits | $0.43 = 10.8 credits |
| Sonnet, today | $0.036 = 0.9 credits | $0.22 = 5.4 credits |
| Haiku, today | $0.002 = 0.04 credits | $0.01 = 0.3 credits |
| Sonnet with caching (target for Auto) | $0.015 = 0.4 credits | $0.054 = 1.3 credits |
| Opus with caching | $0.030 = 0.8 credits | $0.107 = 2.7 credits |
| Treatment or Prompts turn on Sonnet (8k in, 1.2k out) | $0.028 = 0.7 credits | n/a |
Chat stays metered in credits at 2.5x (as built: `chargeChat` after the reply, from real usage, min 1 tenth, `CHAT_START_CREDITS` 5 tenths to start). The daily message caps (`CONNECT_DAILY_MESSAGES` 100, `AGENT_DAILY_MESSAGES` 200, `TREATMENT_DAILY_MESSAGES` 100) stay as abuse limits. Free accounts have no chat (subscription alert).

## 9. Sandbox and Core tools (unchanged, shown in tenths)
Build session 10 tenths (1 credit) per 5 minutes, tool run 5 tenths (0.5), media mux 5 tenths (0.5): `SANDBOX_CREDITS_BUILD_5MIN=10`, `SANDBOX_CREDITS_TOOL_RUN=5`, `SANDBOX_CREDITS_MUX=5`. Paid plans only, as built.

## 10. Direct routes (cheaper than Higgsfield)
For most models the maker's price equals Higgsfield's (MiniMax H3, Wan 3.0 and Prime, Grok Video, LTX, Recraft, Kling without sound): keep them on Higgsfield. Three routes are clearly cheaper:
| Model | Via Higgsfield | Direct | Provider and key |
|---|---|---|---|
| Seedance 2.0 and 2.5 | see section 5 | see section 6 | BytePlus ModelArk, existing `ARK_API_KEY` |
| Qwen Image 3 and Edit | 1k $0.04, 2k $0.075 per image | $0.0248 per image at 1k and 2k | Alibaba Model Studio (Singapore), `DASHSCOPE_API_KEY` (the Qwen voice key) |
| Grok Image 2.0 at 2k | $0.08 | $0.04 | xAI, new Secret `XAI_API_KEY` |
Not now: Kling direct (11 to 17% cheaper with sound but needs prepaid packages), PixVerse (dearer direct). Only on Higgsfield: Soul family, Marketing Studio, Ads Studio, Cinema Studio, Genjutsu.
Build rules:
- One Config value per model, `ROUTE_<MODEL_ID>=direct|higgsfield` (default `higgsfield`). The credit price follows the route the render really uses and is shown before running. If the direct key is missing or the provider fails BEFORE starting, fall back to Higgsfield and charge the Higgsfield price (shown first).
- Do NOT build any direct provider from memory. The owner attaches a reference file for each: `docs/video-providers/byteplus-seedance.md`, `docs/image-providers/qwen-image.md`, `docs/image-providers/xai-imagine.md`. Until a file exists build only the route switch, the prices and the fallback, against a fake provider. The BytePlus Seedance route is the priority: without it video prices in section 5 are about 2x dearer than Higgsfield's retail.
- Cheap options available only direct, NOT in Eclipse yet (later, optional): Seedance 2.0 Fast (about $0.07/s at 720p), Grok Imagine Video 1.5 Lite (from $0.02/s, 1080p is upscaled 720p), MiniMax H3-Max ($0.05/s at 480p).

## 11. Owner price-check page
Add `/admin/pricing` (owner only; link from `/admin/health`) listing every model and setting with: provider list cost (from this file), credits charged, and the worst-case margin at each plan's net value per credit: `(plan price x (1 - 0.062) - 0.30) / credits`. Flag any row under 20% in red. For Higgsfield, if the API has a price-estimate request (a third-party article says it does; NOT VERIFIED, check `docs/` for the API reference), call it per setting and show the live price next to ours, flagging any row where live cost / credits charged is above the rule. Never charge from the live estimate; it is a check only. Also show this month's real Anthropic spend (from the meter) next to chat credits charged.

## 12. Config values and Secrets (the owner sets them in Vercel, Production and Preview, then redeploys once)
| Name | Value | Type |
|---|---|---|
| `AUDIO_MARGIN` | 2.5 | Config |
| `AUDIO_CREDIT_USD` | 0.01 | Config |
| `CHAT_MARGIN` | 2.5 | Config |
| `CHAT_CREDIT_USD` | 0.01 | Config |
| `VIDEO_MARGIN` | 1.8 | Config |
| `VIDEO_CREDIT_USD` | 0.10 | Config |
| `FREE_RENDERS_COUNT` | 2 | Config (already 2; do NOT set `FREE_RENDERS_MAX_CREDITS`) |
| `ROUTE_SEEDANCE_2_0`, `ROUTE_SEEDANCE_2_5` | `direct` once the BytePlus route is tested | Config |
| `XAI_API_KEY` | only when the Grok Image route is wanted | Secret |
Owner steps outside the app: (1) in Whop change the three top-up plans to $6, $22, $60; (2) open the BytePlus console, ModelArk pricing, and screenshot the Seedance 2.0 and 2.5 prices so the estimates in section 6 can be confirmed (BytePlus resource packs are listed at $4.30 per million tokens for 2.0 Standard, which would make it cheaper still); (3) attach the three provider reference files in section 10 when ready; (4) fix the failed payment on the Higgsfield account (its banner says unlimited generations are paused) so renders do not stop.

## 13. Build order (one batch each; green tests before the next)
1. **Units and plans:** tenths constant and display helper, `plans.ts` (credits, packs), balance, ledger display, Whop pack prices, landing and Billing copy and badges, free-trial subscription alert. No model prices yet.
2. **Image prices** per resolution (section 4), button prices, Soul batch rule, GPT Image 1 hidden.
3. **Video prices** (section 5) per second by resolution, once-rounded clip price, confirm threshold and daily cap defaults, `docs/video-pricing.md`.
4. **Anthropic:** Auto to Sonnet, picker notes, `PRICES` update, caching in the Core and Atlas loops, meter counts cache tokens, history trimming (fix 3), tests.
5. **Audio config** defaults (2 numbers) and the unit display in tenths.
6. **Direct routes:** switch, fallback and prices first (fake provider), then each real provider as its reference file arrives (Seedance first).
7. **`/admin/pricing`** page.
8. **Hardening:** abuse limits, the free-trial farm check, a full dry run of every price with a fake provider, VERIFICATION REPORT.

## 14. Tests
- Display: 10 tenths shows "1", 1874 shows "187.4". Plan grants 2,000 / 6,000 / 25,000 tenths. Pack grants 500 / 2,000 / 6,000.
- Images: every row of section 4 charges that many credits at that resolution; a 2k render holds the 2k price; Soul 2 batch of 4 charges 1 credit total.
- Video: a 4 s Seedance 2.5 clip via Higgsfield = 15 / 34 / 82 credits at 480p / 720p / 1080p and Seedance 2.0 = 11 / 22 / 49; `ceil(seconds x credits per second)` once; 4 s Seedance 2.5 1080p direct = 41 credits (410 tenths); 5 s Seedance 2.5 720p direct = 21; 5 s Kling 3.0 Pro with sound via Higgsfield = 16; failed renders release the hold.
- Free trial: two image renders free; the third attempt shows the subscription alert; video, audio, chat on a free account show it at once; no credits granted at sign-up.
- Anthropic: Auto resolves to Sonnet; step 1 of a Core tool loop writes the cache and later steps read it (assert `cache_read_input_tokens > 0` in a recorded fake); metered credits use cache prices; an image or large tool result older than two turns is shortened in what is sent but not in the stored chat; the server-side fallback still works.
- Routes: `ROUTE_*=direct` with a missing key falls back to Higgsfield and shows the Higgsfield price first.
- Margin guard: a unit test that fails if any model's credits x net value per credit at Scale is below cost x 1.2 (the margin floor), using the cost table in this file.

## 15. NOT VERIFIED (do not guess; test and report each as a finding with evidence)
1. Estimated provider costs marked "Estimate, measure": Soul Cinema 1080p, Marketing Studio 4k low and Flare/Sunburst, Grok Image 2 at 2k low, Nano Banana 2 Lite, GPT Image 2.5 and GPT Image 2 at 2k, Seedream 5.0 Pro at 2k and 5.0 Flash, Kling 3.0 4K, Kling 3.0 Standard with sound, Wan 3.0 Prime 720p and 1080p, Kling 2.6 Motion Control. Measure each with one cheap render and the account's balance, then update the table.
2. BytePlus Seedance costs: derived from about $6.40 (2.0) and $10.70 / $11.70 (2.5) per million tokens, with tokens = seconds x width x height x 24 / 1024. Confirm in the console.
3. Whether Higgsfield's price-estimate endpoint exists and what it returns.
4. Minimum cacheable prompt size and cache behaviour for Opus, Sonnet and Haiku 5.5; Sonnet 5.5 cache-read price ($0.10 vs $0.20); whether the fallback beta keeps cache hits.
5. Real token use per Core, Atlas, Treatment and Prompts message (the estimates in section 8 are assumptions).
6. Whop's exact fees for the owner's account (6.2% + $0.30 is a worst-case estimate from a third-party article).
7. Whether a Higgsfield batch of 4 Soul 2 images costs 4x one image (assumed).
