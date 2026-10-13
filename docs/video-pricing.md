# Video credit prices (PROVISIONAL)

Higgsfield's video pages publish no prices, so every number below is a deliberately HIGH placeholder, set in `src/lib/video-models.ts` (`price.perSecond`, `audioFactor`) and computed by `videoPrice` (whole credits, at least 1). Nothing is charged until `CREDITS_ENABLED=1`. Do not publish or sell on these numbers.

| Model | Credits per second | Sound factor |
| --- | --- | --- |
| Kling 3.0 Standard | 14 | x1.5 |
| Kling 3.0 Pro | 22 | x1.5 |
| Kling 3.0 4K | 40 | x1.5 |
| Kling 3.0 Turbo | 720p 10, 1080p 18 | no sound |
| Kling 2.6 Pro | 22 | x1.5 |
| Kling 2.5 Turbo Pro / Standard | 14 / 8 | no sound |
| Seedance 2.0 | 480p 10, 720p 20, 1080p 40, 4k 90 | x1.25 |
| Seedance 2.5 | 480p 10, 720p 20, 1080p 40 (same placeholder as 2.0, up to 30 s, so a 30 s 1080p clip with sound is 1500) | x1.25 |
| Happy Horse 1.0 | 720p 12, 1080p 22 | none |
| Wan 3.0 | 480p 8, 720p 14, 1080p 24 | x1.25 |
| Wan 3.0 Prime | 480p 12, 720p 20, 1080p 34 | x1.25 |
| Wan 2.7 | 720p 10, 1080p 18 | none |
| Wan 2.6 | 480p 6, 720p 9, 1080p 16 | none |
| MiniMax H3 | 2K 20 | none |
| Hailuo 2.3 Standard | 8 | none |
| LTX-2.5 Fast | 720p 6, 1080p 10, 2k 16, 4k 28 | x1.2 |
| LTX-2.5 Pro | 720p 10, 1080p 16 | x1.2 |
| Grok Video 1.5 | 480p 8, 720p 14, 1080p 26 | none |
| Cinema Studio 4.0 | 480p 16, 720p 28 | x1.25 |
| Kling Motion Control (Motion chip) | Standard 14, Pro 22, per second of the MOTION CLIP | none |
| Genjutsu motion transfer (Motion chip) | 480p 40, 720p 85, 1080p 204 per clip second (cut to 30 s; reuses the only published Genjutsu price scale, motion transfer's own price is unpublished) | none |
| Happy Horse 1.1 | 720p 14, 1080p 26 | none |
| PixVerse V6 | 360p 6, 540p 9, 720p 14, 1080p 26 | x1.3 |

Example: Kling 3.0 Pro, 5 s, sound on = 22 x 5 x 1.5 = 165 credits.

## How to replace them with measured prices
1. Note the Higgsfield balance, run one render per model and setting (shortest duration, lowest resolution first), note the balance again.
2. Divide the difference by the seconds to get the real cost per second; repeat for each resolution and for sound on/off.
3. Put the numbers in the registry, add the margin, remove "provisional" wording in the UI.

Safeguards while prices are provisional (Config values, none are secrets): `VIDEO_KILL_SWITCH=1` refuses all new videos; `VIDEO_RENDERS_PER_MINUTE` (6), `VIDEO_RENDERS_PER_DAY` (30), `VIDEO_MAX_RUNNING` (3), `VIDEO_DAILY_CREDITS` (2000), `VIDEO_CONFIRM_CREDITS` (300: a render above this asks for a confirm).

Note: a 10 s Genjutsu clip at 1080p is 2,040 credits, over the default `VIDEO_DAILY_CREDITS` (2000); raise it (Config value) when real prices are known.
