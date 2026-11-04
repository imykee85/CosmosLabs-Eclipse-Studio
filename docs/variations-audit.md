# Variations: audit and build status (2026-11-04)

Built from the owner's Variations brief. Phase 0 (the audit) could not be run against live providers: this sandbox reaches none of them, so nothing here has been scored on real images.

## What Eclipse already had
- No Variations feature. The tray chip called "Variations" only re-ran the same prompt; it now opens the new tool.
- Reused as they were: `startImages` (one render per request, ledger holds and charges per render), the picture-editing model choice (`toolModel`), uploads, the Library and Gallery, the Canvas node registry, sharp (thumbnails).

## Approach chosen (not tested live)
- **A, one call per cell.** Each cell is its own render from the same picture with its own instruction and the same seed (where the model has seeds). A failed cell never spoils the others, each is priced and charged by the normal ledger, and failed cells are not charged.
- **The contact sheet is composed by us afterwards** (`src/lib/variations/sheet.ts`, sharp), not asked of a model, so cells are never mis-sliced. Resolution per cell is the full chosen quality, not shared across the grid.
- Approach B (one model call returning a contact sheet, then slicing) was not built or compared.

## Built
- Four modes: Reframe (16 perspectives, one per cell), Storyboard (your scenes, or Auto: a short story written from the picture by a small text model), People (Demographics, Expressions, Age), Custom.
- Grid 1x2 to 3x3, aspect ratio (Auto follows the picture), quality; the price is cells x one image.
- Results window: per-cell progress, the sheet (open, download), download all as a zip, send to canvas, per-cell open / compare / download / use as new reference / upscale.
- Entry points: the Variations chip in Image Studio's tool tray and a Variations button in image details (Library, Gallery). Eclipse has no separate "Image tools list" page, so there is no third entry.
- Canvas: a Variations node (picture in, optional text in; the cells and the sheet out).

## Not done, and why
- Not tested against any live model: identity and lighting consistency across cells, whether the perspective names are obeyed, Storyboard story quality.
- Which grids are valid per aspect ratio: not known, all grids are offered.
- Strip of EXIF on stored cell copies: cells are stored as the provider returned them; only the sheet is re-encoded clean.
- Free trial: free renders are used cell by cell like any render; the Generate button says Free only when enough are left.

## Safety
People mode needs a tick ("my own picture, or the person agreed"). Age only offers adult ages. Demographics follows the ticked list (plain data in `src/lib/variations/prompt.ts`). Eclipse's prompt moderation runs on every cell. Minors cannot be detected in a picture, only by words.
