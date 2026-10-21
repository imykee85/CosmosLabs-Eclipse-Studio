# Last hour

Parked by the owner (2026-10-20, Android, keys and DOP added the same day). They will ask for these separately. Do NOT list them in PVU, FVU or any to-do again.

1. Content: onboarding video, tutorial videos, landing card and results pictures, and the pictures for the empty dashboard cards (Interiors, Product shots, Beauty shots, the looks and the video library cards).
2. MOVED TO V2 (owner 2026-10-21): Higgsfield video models still on "Soon" (Kling O3/Omni, FLUX 3 Video). Seedance 1.5 Pro and Cinema Studio 3.0 were removed (replaced by newer versions); Seedance 2.0 Mini runs on the direct route. See `docs/v2.md`. The constraints already received are in `docs/image-providers/higgsfield-video-constraints.md`.
3. Android: check the site on an Android phone (layout, text boxes, video, sign-in). The owner will do this separately.
4. Provider keys and direct routes: Secrets `XAI_API_KEY`, `DASHSCOPE_API_KEY`, `MIRELO_API_KEY`, and the Config values `ROUTE_QWEN_IMAGE_3=direct`, `ROUTE_QWEN_IMAGE_3_EDIT=direct`, `ROUTE_GROK_IMAGE_2=direct` once the keys are in.
5. MOVED TO V2 (owner 2026-10-21): "Eclipse DOP V1" and the keys for the image makers still marked Soon. See `docs/v2.md`.
6. BytePlus Seedance direct route setup (owner 2026-10-21: "Keep the direct configs on last hour. I'll do them later"): activating Seedance 2.0 and 2.5 in the BytePlus console (balance above USD 30 or a resource pack), the optional Config values (`ROUTE_SEEDANCE_2_5` / `ROUTE_SEEDANCE_2_0` set to `higgsfield` to switch one off, `ARK_VIDEO_MAX_CONCURRENT`, `ARK_VIDEO_MODEL_SEEDANCE_*`), the first cheap live test and the token check in `/admin/jobs`. The code is already ON by default and falls back to Higgsfield until BytePlus is activated; nothing is waiting on the owner for it to run.
