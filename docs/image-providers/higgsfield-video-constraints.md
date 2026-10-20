# Higgsfield model constraints (items 1 to 9 of docs/pages-needed-from-owner.md)
Source: Higgsfield's own model catalogue (`models_explore`), read 2026-10-20 and pasted by the owner. NOT the REST request page: HTTP field names may differ; keep the existing client's mapping and use this for values and slot roles. Prices are not in it. NOT BUILT yet.

- Kling 3.0 Omni `kling_o3_image_reference`: duration 3-15 (default 5); mode std|pro|4k; sound on|off; multi_shots + multi_prompt [{prompt, duration}]; medias role image_references (up to 7); ratios 16:9, 9:16, 1:1.
- Kling 3.0 Omni (Frames) `kling_o3_flf`: same fields; medias roles start_image, end_image.
- Kling 3.0 Omni Edit `kling_video_edit`: mode std|pro|4k (default pro); medias roles video_references, image_references; no ratios.
- Kling 3.0 Motion Control `kling3_0_motion_control`: mode std|pro; background_source input_image|input_video (default input_image) = the "scene control" field; roles image_references, video_references.
- Genjutsu `hf_mult_motion_control` / `hf_mult_replace_object` (object swap): resolution 480p|720p|1080p (default 720p); roles image_references, video_references. Lite variants `_flash` (Wan 3.0, up to 15 s) same fields.
- Seedance 2.0 Mini `seedance_2_0_mini`: duration 4-15 (default 5); resolution 480p|720p; bitrate_mode standard|high; genre auto|action|horror|comedy|noir|drama|epic; generate_audio; roles start_image, end_image, image_references, video_references, audio_references; ratios auto,16:9,9:16,4:3,3:4,1:1,21:9.
- Seedance 1.5 Pro `seedance1_5`: duration 4|8|12; resolution 480p|720p|1080p; generate_audio; roles start_image, end_image; same ratios.
- Cinema Studio Video 3.0 `cinematic_studio_3_0`: resolution 480p|720p|1080p|4k; genre as above; generate_audio (default false); roles image, start_image, end_image; duration 4-15; ratios auto,21:9,16:9,4:3,1:1,3:4,9:16.
- FLUX 3 Video `flux_3_video`: duration 5-20; resolution 720p|1080p|2k|4k; generate_audio; roles start_image, end_image, image_references, video_references; ratios auto,21:9,2:1,16:9,4:3,1:1,3:4,9:16. Edit `flux_3_video_edit`: role video_references, first 15 s, 1 credit per second (Higgsfield's own credit).
- NOT VERIFIED: the Genjutsu styles list call, 3D scene API (a separate 3D scene builder), prices of all of the above.
