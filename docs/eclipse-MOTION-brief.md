# Eclipse MOTION (working name: "Eclipse Motion") — Build Brief for Claude Code

> **Naming:** the feature is called **Eclipse Motion** for now. Mike may rename it. Use one constant in code (`FEATURE_NAME`) so it changes in one place.
> **Stage:** after Canvas, the security patch and Video Edit (if Mike has not said otherwise). Do not start until Mike says so.
> **Goal:** a native Eclipse feature that makes **motion design videos** from templates: title cards, kinetic text, logo reveals, lower thirds, social ads, stat animations, photo montages and burned-in captions. The user fills in a few inputs (text, colours, logo, images, duration). A render worker produces an MP4. It is available as a Canvas node and, later, as a standalone tool page.
> **Not in scope:** photoreal or AI-generated footage (that is the Video Generator). Motion Graphics are made from code and templates, so the result is exact, repeatable and cheap.

## 0. Ground rules
- Work on a branch `feature/motion`. Preview deploy only; no production merge without Mike's OK.
- Reuse Eclipse's existing pieces: uploads (R2), generation records, credits ledger with hold → settle → release, idempotency key, free-trial guard, SSE status, the media worker from the Canvas brief. Do not build a second ledger or a second worker system.
- Do not run rendering in Vercel functions. Rendering runs in the media worker (container with Node, Chromium, ffmpeg).
- Never put provider keys in code or reports.
- Mobile and desktop are equal (Canvas brief, Part D): every control works from the bottom sheet on a phone.

## 1. Phase 0: audit and decisions (blocks everything else)
1. **Renderer choice.** Compare and report:
   - **Remotion** (React compositions, official renderer). Check the **current licence terms** (free for individuals and very small teams; a paid company licence is required above a size threshold). Report whether Cosmos Labs / Eclipse needs one and the cost.
   - **HTML/CSS/GSAP + Playwright frame capture + ffmpeg** (no licence issue, more plumbing; deterministic frame stepping must be implemented).
   - Recommend one with reasons. **Wait for Mike's choice** if a paid licence is involved.
2. **Worker audit.** Does the media worker from the Canvas brief exist? What are its CPU/RAM limits, queue, timeout, and cost per render minute? Chromium and fonts must be installed. Report what is missing.
3. **Existing assets.** Check what Eclipse already has for video composition (Video Combiner ffmpeg code, caption code, fonts, brand kit, logos). Reuse, do not rewrite.
4. **Fonts and licences.** List fonts to bundle. Only fonts with a licence that allows embedding in rendered video (e.g. open-source fonts). Report any font Mike wants that is not allowed.
5. Write results to `docs/motion-audit.md`.

## 2. Phase 1: render core (no UI)
1. **Template contract.** Each template is a folder with: `schema.json` (input fields, types, defaults, limits), `composition` (the code), `preview.png`, `meta.json` (name, category, supported aspect ratios 9:16 / 1:1 / 16:9 / 4:5, min and max duration).
2. **Render API.** `POST /api/motion/render { templateId, inputs, aspect, duration, fps, quality }` creates a job, holds credits, enqueues it for the worker and returns a job ID. Status over the existing SSE pattern. Output goes to R2 as MP4 (H.264, yuv420p, AAC silent track optional).
3. **Deterministic frames.** The same inputs must produce the same video. No random seeds unless the input includes one.
4. **Quality tiers.** `preview` (540p, 24 fps, fast) and `final` (1080p default, up to 4K if the worker allows, 30 fps). The preview is free or heavily discounted; final uses full credits.
5. **Safety limits.** Max duration (e.g. 30 s), max text length, max image size, max concurrent renders per user, timeout with release of the credit hold on failure.
6. **Tests:** golden-frame tests per template (render frames 0, middle, last for a fixed input and compare), plus a timing test that logs render time per second of video.

## 3. Phase 2: templates (build in this order, quality over quantity)
Make each one look professional on its own before moving on. Each supports the four aspect ratios, with safe margins for phone screens.
1. **Title card** — text in/out, 4 style variants.
2. **Kinetic text** — word-by-word or line-by-line with easing and emphasis colours.
3. **Logo reveal** — user logo (PNG/SVG) with 4 reveals (mask wipe, light sweep, scale-settle, particles).
4. **Lower third** — name and role, on a transparent or solid background, for use over clips.
5. **Social ad** — hook line, product image, offer, CTA, with the brand colours.
6. **Stat / counter** — animated numbers and bars.
7. **Photo montage** — 3–12 images with Ken Burns and transitions, optional beat marks.
8. **Captions** — burn timed captions onto an uploaded video (SRT or typed lines), 5 styles.
Rules for all templates: easing curves (no linear motion), 12-frame minimum for any entry/exit, text never leaves the safe area, no overlapping text, no flicker on text edges.

## 4. Phase 3: Canvas node
One node, **Motion** (`motion-graphic`), registered like the other Canvas nodes:
- **Inputs:** text (violet), image (blue), video (green, for lower thirds/captions on top of video), audio (teal, optional, mixed under).
- **Output:** video (green), tooltip "Motion video".
- **Controls:** template picker (with preview thumbnails), the template's input fields, aspect ratio, duration, brand colours (from the Eclipse brand kit if set), Preview / Final.
- **Run flow:** Preview render (shown in the node) → user edits → Final render.
- **Cost:** `estimateCost` shows the price from duration × quality tier with the pricing master's markup. Hold at start, settle on success, release on failure. Idempotency key `canvasId:nodeId:runId`.
- **Free trial:** preview allowed, final blocked with the upgrade prompt (confirm with Mike).
- Works with the Video Combiner, Video Upscaler and Media Extractor nodes.

## 5. Phase 4: AI prompt layer (after templates are good)
- The user types a plain-language request ("bold intro for a skincare brand, gold and black, 5 s"). An LLM picks a template and fills the inputs from its `schema.json`. **The model only fills fields; it never writes composition code.**
- Output is validated against the schema (length, colours, fonts) before rendering. Show the chosen template and inputs so the user can change them.
- Use the existing Assistant node route and its credit rules.

## 6. Phase 5: standalone page (optional)
A "Motion" tool page in Eclipse's tool list with the same flow, so users who don't use Canvas can make videos. Same API, same credits.

## 7. Acceptance tests
1. Each template renders in all four aspect ratios with no clipped or overlapping text.
2. Same inputs → same video (frame hash match).
3. Preview and Final both complete; the Final's first frame matches the Preview's.
4. Credits: hold = estimate, settle = actual, failure releases; idempotency prevents double charge.
5. Free-trial rules behave as agreed.
6. Limits: an over-long duration, huge image or very long text is rejected with a clear message and no charge.
7. Fonts embedded correctly (no fallback font in the render).
8. Plays on iPhone Safari and desktop Chrome; downloads as a normal MP4; plays in the Video Combiner.
9. Mobile: every control usable from the bottom sheet; preview playback is smooth.
10. AI layer (if built): 20 test prompts produce valid schema outputs, with no render crash.

## 8. Ask Mike (CC may ask; expected questions)
1. Renderer choice, and whether he will pay for a Remotion company licence if needed.
2. Which of the 8 templates to launch with, and which to cut.
3. Price per second at preview and final, and whether preview is free.
4. Maximum length and resolution at launch (30 s / 1080p suggested).
5. Brand kit: should Eclipse store a user's logo, colours and fonts?
6. Should captions use speech-to-text, or only typed or uploaded text at launch?
7. Where the media worker runs and who pays for it.
8. Does Mike want the standalone page, or the Canvas node only?

## 9. Out of scope
AI-generated footage, 3D scenes, After Effects project import, user-uploaded custom fonts or code, music generation.
