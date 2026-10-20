# Video prices

**Source: `docs/eclipse-PRICING-MASTER-brief.md` section 5 (owner, 2026-10-20).** This file replaces the earlier 2.5x tables.

## Rule
`credits = ceil(seconds x provider list cost per second x VIDEO_MARGIN / VIDEO_CREDIT_USD)`, rounded ONCE for the whole clip, never per second (`videoCreditsForUsd` in `src/lib/price-constants.ts`, used by `videoCredits` in `src/lib/video-models.ts`). `VIDEO_MARGIN` = 1.8 and `VIDEO_CREDIT_USD` = 0.10 (Config values; the browser shows the defaults, the server charges from the environment). The ledger holds tenths of a credit, so a 21-credit clip is 210 ledger units. Provider LIST prices only; Higgsfield promotions are not used. Motion Control and Genjutsu are per second of the motion or source clip. The Seedance direct (BytePlus) route has its own costs (section 6 of the brief) and is used only when its setting, key and adapter exist (`src/lib/routes.ts`).

Limits (Config values, now in CREDITS): `VIDEO_DAILY_CREDITS` default 5000, `VIDEO_CONFIRM_CREDITS` default 500. The code converts them to ledger units.

Seedance 2.0 and 2.5 take clips from 4 s (read from each model's `durations` in `video-models.ts`; checked: minimum 4 for both).

## Table (copied from the brief; the unit test `tests/unit/pricing.test.ts` asserts every row for 5 s and 4 s)
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
