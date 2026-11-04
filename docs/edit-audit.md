# Edit and Retouch: audit and build status (2026-11-04)

Built from the owner's Edit & Retouch brief. Phase 0 could not be run against live providers (this sandbox reaches none of them): nothing here has been scored on real images.

## What Eclipse already had
- No image editor, no mask tool, no inpainting route, no segmentation. `MarkDialog` (draw or pin on a picture for the chat) and the Image Studio tool tray (Relight, Change camera, Upscale ...) existed; the tray's Edit chip only attached the picture as an ingredient.
- Reused: `startImages` and the ledger (hold, charge, release per render), uploads, `toolModel`, the Library and Gallery, `ReferencePicker`, versions are plain `Generation` rows linked through `params`.

## Model routes (NOT VERIFIED)
- **Instruction edit** (Edit: Prompt, Visual, reference pictures): the best picture-editing model the account can run, exactly as Relight and Change camera do. Pins become text ("At the point 42% from the left and 61% from the top: ...").
- **Retouch has a REAL MASK route on OpenAI models (built 2026-11-04).** The selection is uploaded as a small picture (`maskId` on `POST /api/generate`, owner-checked), the server makes the provider mask from it (`src/lib/edit/mask.ts` `openaiMask`: the picture's own size, fully transparent where selected, opaque elsewhere) and sends it as `mask` next to the picture in `/images/edits` (`openai.ts`). The editor prefers a model with `maskEdit` (OpenAI). The mask field shape (`mask: {image_url}` in the JSON edit body) is from memory of OpenAI's docs and has NOT been run against the live API: the first live Retouch on a GPT Image model will show. For every other model (no mask parameter) the fallback below is used: the picture with the selection painted translucent blue goes in as the second picture with a text instruction. After the model answers, our own compositing pastes ONLY the selected area (grown a few pixels, feathered) back onto the original, so everything outside the selection stays pixel-identical (unit and database tested). Whether a real model follows "work only inside the blue area" and hides the blue is untested live.
- **Click select** is a colour-region "magic wand" in the browser, not a learned segmentation model. It works on clear, flat shapes; use Brush or Lasso for the rest. A hosted segmentation route was not chosen (needs the owner's decision and a price).
- Auto = the best available editing model that takes the needed number of pictures (two for Retouch). The model chip lists the others.

## Built
Full-screen editor (`src/components/edit/ImageEditor.tsx`, logic in `src/lib/edit/`): Edit with Prompt and Visual tabs, Retouch with Replace/Erase and Brush/Lasso/Click, brush size, undo/redo/clear, zoom and pan (wheel, buttons, pinch, hand), hold to compare, reference attach (device, creations, ingredients through the existing picker), model/resolution/images chip (1 to 4), variations tray (hover or tap previews on the canvas, Keep saves a version), history timeline (branching), recent pictures strip, download. Entry: the Edit chip in the Image Studio tray and "Edit image" in image details. Keep-identical wording is added behind the scenes; the person's own words are stored on the version.

## Not built
- Canvas nodes (Edit Image, Retouch): the owner did not ask for Canvas changes in this pass.
- A separate "Image tools list" entry (there is no such page).
- "Keep original outside change" for Edit without a mask (the brief says default off, ask): not built.
- Moderation of the OUTPUT picture, and detection of minors in a picture: Eclipse moderates the words only.
- EXIF stripping of the stored raw renders (the Retouch result is re-encoded clean).
- The Retouch selection picture is uploaded to Assets as "Retouch selection" so the model can read it; it stays there until deleted.
