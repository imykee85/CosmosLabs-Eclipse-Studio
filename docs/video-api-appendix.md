# Higgsfield video API appendix (owner's reference of 2026-10-13, condensed; status of what Eclipse has built)

Base `https://api.higgsfield.ai`, all `POST`. Headers `Authorization: Key <id>:<secret>`, `Content-Type`, `Idempotency-Key`. Submit gives `request_id`, `status_url`, `cancel_url`; poll `status_url` until `completed` (`video.url`); states queued, in_progress, completed, failed, nsfw, canceled. Public https media only (`asset://` rejected; we use signed R2 links). Send only the fields an endpoint lists. Full per-model field tables: `docs/seedance-api.md`, `docs/kling-api.md`; the rest are in the registry (`src/lib/video-models.ts`, one spec per family with per-workflow overrides in `byWf`).

## Built (2026-10-13), by model (id in the registry)
| Model | Endpoints used | Notes |
| --- | --- | --- |
| Happy Horse 1.0 `happy_horse_video` / 1.1 `happy_horse_1_1` | `alibaba/happy-horse/{,v1.1/}{text,image,reference}-to-video` | seed 1 to 2147483646; reference pictures 1 to 9, prompt required, no shape on references |
| Wan 3.0 `wan3_0` / Prime `wan3_0_prime` | `alibaba/wan-3.0{,-prime}/...` | 2 to 30 s, sound, shape incl. "adaptive" on all three, seed from 1; reference pictures 10 + clips 5; document/link references and deep thinking NOT offered |
| Wan 2.7 `wan2_7` | `wan/v2.7/...` | reference pictures + clips at most 5 together, references 2 to 10 s and 16:9/9:16 only; negative prompt |
| Wan 2.6 `wan2_6` | `wan/v2.6/...` | 5/10/15 s, no shape on text and image, reference-to-video takes CLIPS only (1 to 3, 5 or 10 s, no seed) |
| MiniMax H3 `minimax_h3` | `minimax/h3/...` | 2K only, `aigc_watermark` always false, references 9 pictures + 3 clips |
| Hailuo 2.3 Standard `minimax_hailuo` | `minimax/hailuo-2.3/standard/{text,image}-to-video` | 6 or 10 s, fixed 768P |
| LTX-2.5 Fast `ltx_2_5` / Pro `ltx_2_5_pro` | `lightricks/ltx-2.5/{text,image}-to-video/{fast,pro}` | 6/8/10 s, 16:9 or 9:16, sound; Fast adds 2k and 4k; fps and camera moves left to defaults |
| Grok Video 1.5 `grok_video_v15` | `xai/grok-imagine-video/v1.5/reference-to-video` (one endpoint for text, first frame, references) | references (up to 7) allow 480p or 720p only |
| Cinema Studio 4.0 `cinematic_studio_video_4_0` | `higgsfield/cinema-studio/4.0` | text or references (30 pictures + 10 clips), 480p/720p, 4 to 30 s; era, genre, light, camera controls NOT offered (the 48-value colour palette list is still unknown) |
| Kling Motion Control (4 hidden engines) and Genjutsu motion transfer (hidden) | `kling-video/{v3/,}motion-control/{pro,std}`, `higgsfield/genjutsu/motion-transfer/v1.0` | ONLY through the Motion chip (not in the model picker): subject picture = Start frame, ONE motion clip = one of the user's own finished videos, no duration sent, priced by the clip's length (cut to 30 s) |

## Not built yet
Genjutsu object swap and restyle (restyle needs the preset catalog, REST listing unknown; object swap needs a 409,600 px minimum frame), Seedance 2.5 edit and extend, Kling O3 and Omni (first-last-frame, image/video reference, video edit), Kling multi-shot and elements, Wan `audio_url`/`prompt_extend`, reference AUDIO everywhere, uploading a clip from the device (clips come from the user's own finished video renders), the "3D scene" Motion mode.

## Seed
Yes: Happy Horse, Wan 2.7, Wan 2.6, Wan 3.0 / Prime, PixVerse V6. No seed: Kling, Seedance, LTX, MiniMax, Hailuo, Cinema Studio, Genjutsu, Grok.

## Prices
Only Genjutsu Restyle publishes one (per source second: about $0.318 at 480p, $0.681 at 720p, $1.632 at 1080p). Everything else, including the Genjutsu motion transfer placeholders (same scale at about $0.008 a credit), is a provisional placeholder: `docs/video-pricing.md`.

## Live test checklist
One cheap render per endpoint (shortest length, lowest resolution, sound off). Report HTTP status, exact error text, request id, queued-to-completed seconds, MB, audio present, credits spent. On a 404 give the exact URL (compare with the paths above); on a validation error paste it verbatim and do not change the registry silently.
