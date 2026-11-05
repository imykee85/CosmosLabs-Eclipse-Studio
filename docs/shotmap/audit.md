# ShotMap Phase 0 audit (started 2026-11-05)

Status: IN PROGRESS. Engine, schema and the six test blockouts are built; the model tests (section 3) wait for the owner's takes.

## 1. What exists in Eclipse that ShotMap reuses (from the code and CLAUDE.md, not re-verified live)
- Seedance 2.5 reference-to-video is built: pictures (up to 30), the person's own finished videos (up to 10) and sounds (up to 10) as references; a guide clip uploaded from the device becomes an ordinary finished video (`uploadVideo`, `params.uploaded`), so it can be a reference clip with no new route.
- Direct BytePlus route is on by default with a Higgsfield backup (the person confirms the higher price); video input is priced at BytePlus' token rate (`videoCreditsWithVideo`).
- Known risk: BytePlus' privacy filter has refused reference pictures of realistic people (even AI-made); Higgsfield filtered the same pictures differently.
- Sandbox platform (Vercel Sandbox) already runs headless Chromium + ffmpeg (kinetic films) - the planned home of the server guide render (`media.shotguide`, not built yet).
- Plan lock: ShotMap = Growth and above (owner, 2026-11-05).

## 2. Guide render (built for the tests)
- `src/lib/shot/{schema,engine,render-page,scenes}.ts`; `scripts/shot-test/render.mjs` renders with headless Chromium (software GL) + ffmpeg.
- Measured here (this container, 4 cores): 8 s at 1280x720/24 fps = 192 frames in about 10-12 s; 15 s = 360 frames in about 20 s. Far faster than the kinetic-film estimate, so a sandbox render looks feasible (UNVERIFIED inside a real Vercel sandbox).
- Determinism: rendering test 1 twice gave the identical MP4 (same MD5). Seeded shake, no clock.
- Not yet built: depth video, key stills, top-down diagram, metadata.json.

## 3. Model tests (OWNER, cheap draft quality)
Upload each clip in Video Studio (Ingredients -> My videos), model Seedance 2.5, 480p, shortest length, a simple look prompt that says: use the video only for camera and positions, the coloured shapes are stand-ins, show real people in a real place. Three takes each if affordable. Score camera path / blocking / timing / proxies visible (1-5) and note cost and time.
1. t1-pushin (8 s) slow push-in on one actor
2. t2-orbit (10 s) 180 degree orbit
3. t3-shin (8 s, 9:16) locked off at shin height, a grey actor walks up to the lens
4. t4-chase (15 s) two cars side by side, camera between the drivers, lead car pulls ahead
5. t5-crew (10 s) five actors, three pose changes, handheld
6. t6-mirror (12 s) mirror: reflection, swing behind, close profile (expected hardest)
Stop rule from the brief: if no route scores 3 or better on camera path for tests 1-4, report before building the UI.

## 4. Open facts to find
Reference-clip limits on the BytePlus route (length, size, fps), whether the camera (not just motion) is followed, price per second at 480p/720p, how realistic-person references are treated, commercial terms.
