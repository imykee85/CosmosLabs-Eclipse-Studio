# Eclipse EDIT (working name: "Eclipse Edit") — Build Brief for Claude Code

> **Naming:** the feature is called **Eclipse Edit** for now. Mike may rename it; use a single constant in code (`FEATURE_NAME`) so it changes in one place. Do not use the words Genjutsu, Higgsfield, Scenario, Magnific or Spaces anywhere in the UI, code names, URLs or docs written for users.

> **Stage:** after Canvas is finished and after the security patch (`eclipse-SECURITY-AUDIT-oct-2026-brief.md`) is merged. Do not start until Mike says so.
> **Goal:** a native Eclipse feature that changes what is in an existing video while keeping its performance: swap a product/prop/outfit, recast the performer, move to a new place, or restyle. It replaces the Scenario MCP. Eclipse calls its own model routes and its own credits ledger. No Scenario account or MCP is used.
> **Licence:** the source skill `skill/` is MIT (see `skill/SKILL.md` frontmatter). Keep the licence notice and attribution in the repo. Write the Eclipse UI copy and presets in our own words.
> **Source material:** everything CC needs is in `skill/` next to this file: `SKILL.md` (workflow), `references/` (presets.json = 36 presets, presets.md, qa.md, realism-pass.md, sound.md, scenario-mcp.md = the old connector calls to replace), `scripts/` (Python, runs locally, no network).

## 0. Ground rules
- **Read every file in `skill/` before writing code.** Summarise the logic of each script back to Mike in one line each before porting.
- Work on a branch `feature/video-edit`. Preview deploy, no production merge without Mike's OK.
- Never put provider keys in code or the report. Use the existing env/secret setup.
- Reuse Eclipse's existing pieces: uploads (R2), generation records, credits ledger with hold → settle → release, idempotency key, free-trial guard, SSE status. Do not build a second ledger.
- Do not copy the skill's wording into the UI. Do not reuse Scenario branding.

## 1. Phase 0: model audit (blocks everything else)
Find out, from Eclipse's existing routes (Higgsfield and direct providers), whether **Seedance 2.5** supports, for one request:
1. **Reference video input** (source clip, 4–30 s, sets the motion/camera).
2. **Reference image input** (the target frame).
3. **Draft mode** (cheap low-res run) and a **finish step** that upgrades a kept draft to full resolution without regenerating (the skill calls this "Draft Complete").
4. **Audio off** option.
Record for each: endpoint, input names, limits (length, resolution, file size), price at draft and at full quality, rate limits.
Also list the **image edit model** used for target frames (the skill used Gemini 3.0 Pro image editing; use whatever Eclipse routes that does image-to-image edits with reference images).
**If reference video or draft/finish is missing, STOP and report to Mike.** Propose the cheapest alternative (other edit-capable provider) with its price, and wait for his choice.
Write results to `docs/video-edit-model-audit.md`.

## 2. Phase 1: port the pipeline (no UI yet)
1. **Worker:** the Python scripts need ffmpeg and numpy/Pillow. Run them in the media worker from the Canvas brief (container with ffmpeg). Call them from the Next.js API with a signed request; results go to R2; status via the existing job/SSE pattern. Do not run ffmpeg on Vercel functions.
   - Option A (preferred for speed): ship the scripts as-is in the worker, with a thin HTTP wrapper per command.
   - Option B: port to TypeScript only where it's trivial (prompt builder, preset lookup). Keep the checker and ffmpeg steps in Python unless CC proves a TS port matches the Python output on the same test clips.
2. **Prompt builder:** `alter_prompt.py` → Eclipse module `lib/video-edit/prompts.ts` driven by `presets.json`. Must produce the same prompt text for the same inputs (write a golden test per preset).
3. **Prep/probe/frame:** `alter_probe.py`, `alter_prep.py`, `alter_frame.py` (HDR, rotation, VFR, trim 4–30 s, pick a frame at a time).
4. **Checker:** `alter_check.py` (modes swap/recast/motion/restyle; thresholds in `references/qa.md`). Golden test on the skill's own sample clips if available; otherwise on 3 clips Mike supplies.
5. **Finish and sound:** `alter_finish.py` (put source sound back, trim tail, side-by-side), `alter_versions.py` (reel), `alter_split.py` + `alter_assemble.py` (clips over 30 s).
6. Tests: unit tests for each script's output; an end-to-end run on one test clip through the model route in test mode (no real spend beyond one draft).

## 3. Phase 2: the Canvas node
Build one node, **Video Edit** (`video-edit`), registered like the other Canvas nodes:
- **Inputs:** video (required, green port), reference image (blue, optional, for the target frame), text (violet, for the object/person/place description).
- **Output:** video (green), tooltip "Edited video".
- **Controls:** mode dropdown (Swap / Recast / New place / Restyle), preset dropdown filtered by mode, a "who" text field, slot fields from the preset (e.g. "object", "product"), a Draft/Final toggle, sound toggle (default off).
- **Run flow:** prep → target frame (optional) → draft → check → show crops and check verdict → user chooses Keep → finish → finalise → finish-with-source-sound → output.
- **Cost:** `estimateCost` shows the draft price now and the full price after the draft is kept. Use the same credit rules as Video Generator with the markup from the pricing master. Hold the credits at draft start; settle on success; release on failure.
- **Free trial:** blocked for trial users, same as other video nodes.
- **Mobile and desktop:** works from the bottom sheet on phones (per Part D of the Canvas brief). Preview plays in the node.

## 4. Phase 3: standalone page (optional, after Canvas)
A "Video Edit" tool page in Eclipse's normal tools list with the same flow, for users who don't use Canvas.

## 5. Acceptance tests
1. Swap a product in a 6 s clip: draft passes the checker (change, structure, motion, tail) and the 100% crops show the new object.
2. Draft → Keep → finish: output is full resolution, same motion, source sound restored when sound is on.
3. Credits: hold equals estimate; settle matches actual provider price (within the pricing master's rounding); a failed draft releases the hold.
4. Idempotency: rerunning the same run key doesn't charge twice.
5. Clip over 30 s is split and reassembled frame-exact.
6. Free-trial user gets the upgrade prompt, no charge, no call.
7. A content or policy rejection from the provider is shown as an error; the prompt is not reworded automatically (per the skill's rule).
8. Same flows pass on iPhone Safari and desktop Chrome.

## 6. Ask Mike (CC may ask; these are the expected questions)
1. Which provider route to use for Seedance 2.5 edit (or the alternative if Phase 0 fails), and the approved budget per draft and per final.
2. Which target-frame image model to use.
3. Launch modes: swap only, or all four?
4. Default sound on or off, and default draft or final?
5. Where the media worker runs and who pays for it.
6. Does Mike want the standalone page, or Canvas node only?

## 6b. Genjutsu stays; Eclipse Edit is added alongside it (decision made)
- **Do not remove or replace Genjutsu.** Leave its route, menu entry and existing projects unchanged.
- **Add Eclipse Edit as a second option** in the same menu, with its own entry and its own node (`video-edit`). The two are separate features:
  - **Eclipse Edit:** edits an existing video, keeping its performance (swap object/outfit/product, recast, new place, restyle).
  - **Genjutsu (existing):** motion transfer from a driver video onto a character image, plus object replacement and character sheet animation.
- Do not merge them into one node. Users choose by task. Add a short help line on each entry saying what it does, e.g. "edit a video you shot" vs "animate a character from a driver video".
- **Naming:** Genjutsu is Higgsfield's product name. Keeping it is fine only if Mike's Higgsfield terms allow showing it in Eclipse. CC must flag this in the audit, and Mike decides whether to keep the name or rename it to an Eclipse name (one constant in code). Eclipse Edit keeps the working name above.
- **Test gap:** Eclipse Edit does not cover motion transfer. If Mike later wants a "copy this movement onto my character" feature, that's a third feature, to be scoped separately with a motion-control model. It is not part of this brief.

## 7. Report back
At each phase end, send Mike: what passed, what failed, costs incurred in tests, and the decision needed next. Keep it short.
