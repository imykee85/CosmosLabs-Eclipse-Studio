# Video credit prices (PROVISIONAL)

Higgsfield's video pages publish no prices, so every number below is a deliberately HIGH placeholder, set in `src/lib/video-models.ts` (`price.perSecond`, `audioFactor`) and computed by `videoPrice` (whole credits, at least 1). Nothing is charged until `CREDITS_ENABLED=1`. Do not publish or sell on these numbers.

| Model | Credits per second | Sound factor |
| --- | --- | --- |
| Kling 3.0 Standard | 14 | x1.5 |
| Kling 3.0 Pro | 22 | x1.5 |
| Seedance 2.0 | 480p 10, 720p 20, 1080p 40, 4k 90 | x1.25 |
| Happy Horse 1.1 | 720p 14, 1080p 26 | none |
| PixVerse V6 | 360p 6, 540p 9, 720p 14, 1080p 26 | x1.3 |

Example: Kling 3.0 Pro, 5 s, sound on = 22 x 5 x 1.5 = 165 credits.

## How to replace them with measured prices
1. Note the Higgsfield balance, run one render per model and setting (shortest duration, lowest resolution first), note the balance again.
2. Divide the difference by the seconds to get the real cost per second; repeat for each resolution and for sound on/off.
3. Put the numbers in the registry, add the margin, remove "provisional" wording in the UI.

Safeguards while prices are provisional (Config values, none are secrets): `VIDEO_KILL_SWITCH=1` refuses all new videos; `VIDEO_RENDERS_PER_MINUTE` (6), `VIDEO_RENDERS_PER_DAY` (30), `VIDEO_MAX_RUNNING` (3), `VIDEO_DAILY_CREDITS` (2000), `VIDEO_CONFIRM_CREDITS` (300: a render above this asks for a confirm).
