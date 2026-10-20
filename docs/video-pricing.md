# Video credit prices (owner decision 2026-10-20)

Source of truth in code: `price` on each model in `src/lib/video-models.ts` (`usd`, `usdAudio`, `directUsd`, `estimate`), computed by `videoCredits` / `videoPrice`. The workbook `eclipse-pricing-model.xlsx` has the same numbers with formulas and sources; `docs/pricing.md` explains the rule.

**The rule.** One credit is worth $0.10 to the customer and pays for $0.04 of provider cost (a 2.5x markup). A clip costs `ceil(seconds x provider list cost per second / $0.04)` whole credits, rounded ONCE for the whole clip (never per second), at least 1. The ledger counts in tenths, so the charge is that number x 10. List prices only: the provider's own promotions are not used. Nothing is charged until `CREDITS_ENABLED=1`. Motion Control and Genjutsu are per second of the MOTION/SOURCE clip.

| Model | Setting | Cost/s sound off ($) | Cost/s sound on ($) | Credits/s sound off | Credits/s sound on | 5 s clip with sound (credits) |
| --- | --- | --- | --- | --- | --- | --- |
| Kling 3.0 Standard | any (1080p) | 0.0840 | 0.1260 | 2.10 | 3.15 | 16 |
| Kling 3.0 Pro | any (1080p) | 0.1120 | 0.1680 | 2.80 | 4.20 | 21 |
| Kling 3.0 4K | any (4k) | 0.4200 | 0.6300 | 10.50 | 15.75 | 79 |
| Kling 3.0 Turbo | 720p | 0.1120 | 0.1120 | 2.80 | 2.80 | 14 |
| Kling 3.0 Turbo | 1080p | 0.1400 | 0.1400 | 3.50 | 3.50 | 18 |
| Kling 2.6 Pro | any (1080p) | 0.0700 | 0.1400 | 1.75 | 3.50 | 18 |
| Kling 2.5 Turbo Pro | any | 0.0700 | 0.0700 | 1.75 | 1.75 | 9 |
| Kling 2.5 Turbo Standard | any (720p) | 0.0420 | 0.0420 | 1.05 | 1.05 | 6 |
| Seedance 2.0 | 480p | 0.1407 | 0.1407 | 3.52 | 3.52 | 18 |
| Seedance 2.0 | 720p | 0.3024 | 0.3024 | 7.56 | 7.56 | 38 |
| Seedance 2.0 | 1080p | 0.6804 | 0.6804 | 17.01 | 17.01 | 86 |
| Seedance 2.0 | 4k | 1.5552 | 1.5552 | 38.88 | 38.88 | 195 |
| Seedance 2.5 | 480p | 0.2056 | 0.2056 | 5.14 | 5.14 | 26 |
| Seedance 2.5 | 720p | 0.4622 | 0.4622 | 11.55 | 11.55 | 58 |
| Seedance 2.5 | 1080p | 1.1372 | 1.1372 | 28.43 | 28.43 | 143 |
| Happy Horse 1.1 | 720p | 0.1400 | 0.1400 | 3.50 | 3.50 | 18 |
| Happy Horse 1.1 | 1080p | 0.1800 | 0.1800 | 4.50 | 4.50 | 23 |
| Happy Horse 1.0 | 720p | 0.1400 | 0.1400 | 3.50 | 3.50 | 18 |
| Happy Horse 1.0 | 1080p | 0.2800 | 0.2800 | 7.00 | 7.00 | 35 |
| Wan 3.0 | 480p | 0.0500 | 0.0500 | 1.25 | 1.25 | 7 |
| Wan 3.0 | 720p | 0.1000 | 0.1000 | 2.50 | 2.50 | 13 |
| Wan 3.0 | 1080p | 0.2000 | 0.2000 | 5.00 | 5.00 | 25 |
| Wan 3.0 Prime | 480p | 0.0680 | 0.0680 | 1.70 | 1.70 | 9 |
| Wan 3.0 Prime | 720p | 0.1400 | 0.1400 | 3.50 | 3.50 | 18 |
| Wan 3.0 Prime | 1080p | 0.2800 | 0.2800 | 7.00 | 7.00 | 35 |
| Wan 2.7 | 720p | 0.1000 | 0.1000 | 2.50 | 2.50 | 13 |
| Wan 2.7 | 1080p | 0.1500 | 0.1500 | 3.75 | 3.75 | 19 |
| Wan 2.6 | 720p | 0.1000 | 0.1000 | 2.50 | 2.50 | 13 |
| Wan 2.6 | 1080p | 0.1500 | 0.1500 | 3.75 | 3.75 | 19 |
| MiniMax H3 | 2K | 0.1300 | 0.1300 | 3.25 | 3.25 | 17 |
| Hailuo 2.3 Standard | any (768p) | 0.0560 | 0.0560 | 1.40 | 1.40 | 7 |
| LTX-2.5 Fast | 720p | 0.0900 | 0.0900 | 2.25 | 2.25 | 12 |
| LTX-2.5 Fast | 1080p | 0.1300 | 0.1300 | 3.25 | 3.25 | 17 |
| LTX-2.5 Fast | 2k | 0.1900 | 0.1900 | 4.75 | 4.75 | 24 |
| LTX-2.5 Fast | 4k | 0.3000 | 0.3000 | 7.50 | 7.50 | 38 |
| LTX-2.5 Pro | 720p | 0.1200 | 0.1200 | 3.00 | 3.00 | 15 |
| LTX-2.5 Pro | 1080p | 0.1700 | 0.1700 | 4.25 | 4.25 | 22 |
| Grok Video 1.5 | 480p | 0.0800 | 0.0800 | 2.00 | 2.00 | 10 |
| Grok Video 1.5 | 720p | 0.1400 | 0.1400 | 3.50 | 3.50 | 18 |
| Grok Video 1.5 | 1080p | 0.2500 | 0.2500 | 6.25 | 6.25 | 32 |
| Cinema Studio 4.0 | 480p | 0.2057 | 0.2057 | 5.14 | 5.14 | 26 |
| Cinema Studio 4.0 | 720p | 0.4623 | 0.4623 | 11.56 | 11.56 | 58 |
| PixVerse V6 | 360p | 0.0350 | 0.0350 | 0.88 | 0.88 | 5 |
| PixVerse V6 | 540p | 0.0450 | 0.0450 | 1.12 | 1.12 | 6 |
| PixVerse V6 | 720p | 0.0600 | 0.0600 | 1.50 | 1.50 | 8 |
| PixVerse V6 | 1080p | 0.1150 | 0.1150 | 2.88 | 2.88 | 15 |
| Kling 3.0 Motion Control Pro | per motion-clip second | 0.1680 | 0.1680 | 4.20 | 4.20 | 21 |
| Kling 3.0 Motion Control Standard | per motion-clip second | 0.1260 | 0.1260 | 3.15 | 3.15 | 16 |
| Kling 2.6 Motion Control Pro / Std | per motion-clip second | 0.1680 | 0.1680 | 4.20 | 4.20 | 21 |
| Genjutsu motion transfer | 480p, per source second | 0.3180 | 0.3180 | 7.95 | 7.95 | 40 |
| Genjutsu motion transfer | 720p | 0.6810 | 0.6810 | 17.02 | 17.02 | 86 |
| Genjutsu motion transfer | 1080p | 1.6320 | 1.6320 | 40.80 | 40.80 | 204 |

Direct routes (cheaper, used only when the route is really available, see `src/lib/routes.ts`):

| Model | Setting | Credits per second | 5 s clip |
| --- | --- | --- | --- |
| Seedance 2.0 | 480p / 720p / 1080p | 1.61 / 3.46 / 7.78 | 9 / 18 / 39 (4k stays on Higgsfield: 195) |
| Seedance 2.5 | 480p / 720p / 1080p | 2.69 / 5.78 / 14.21 | 14 / 29 / 72 |

## Not verified (marked "Estimate" in the workbook; confirm with one real render each)
Kling 3.0 4K and Standard with sound, Wan 3.0 Prime 720p and 1080p, Kling 2.6 Motion Control, and the Seedance direct prices (about $6.40 per million tokens, a Chinese list price; BytePlus resource packs are listed at $4.30: if the console says less, lower the per-second numbers with the same rule).

## Safeguards (Config values, none are secrets; amounts are in LEDGER units, tenths of a credit)
`VIDEO_KILL_SWITCH=1` refuses all new videos; `VIDEO_RENDERS_PER_MINUTE` (6), `VIDEO_RENDERS_PER_DAY` (30), `VIDEO_MAX_RUNNING` (3), `VIDEO_DAILY_CREDITS` (5000 = 500 credits a day), `VIDEO_CONFIRM_CREDITS` (500 = 50 credits: a render above this asks for a confirm).

## Checking a price against the bill
1. Note the provider balance, run one render per model and setting (shortest duration, lowest resolution first), note the balance again.
2. Divide the difference by the seconds; compare with the cost per second above.
3. If it is higher, change `usd` in the registry. `/admin/pricing` shows the margin of every row.
