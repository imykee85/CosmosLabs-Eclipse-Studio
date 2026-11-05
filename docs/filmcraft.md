# Timeline editor (FilmCraft web build) in Video Studio

The owner's `filmcraft-main.zip` (open-source video editor, MIT or Apache-2.0, by the ArtCraft team; notices in `public/filmcraft/licenses/`) is built to WebAssembly and shown by the **Editor** chip in Video Studio's tool tray.

- Build (Rust, about 5 minutes with a warm network): `rustup target add wasm32-unknown-unknown`, `cargo install wasm-bindgen-cli --version 0.2.129 --locked`, binaryen's `wasm-opt` on the PATH (the npm package `binaryen` works), then `cargo xtask web` inside the unzipped repo. Copy `target/web/dist/*` to `public/filmcraft/` (the wasm is about 30 MB; the zip's own release builds are about 13 MB).
- The page (`public/filmcraft/index.html`) is static. `next.config.mjs` gives `/filmcraft/*` its own headers (`frame-ancestors 'self'`), `src/proxy.ts` skips `.wasm`, `robots.ts` disallows it.
- `src/components/generate/TimelineEditor.tsx`: full-screen overlay with the editor in an iframe. It waits for `window.filmcraft`, imports the preview clip from `/api/generations/<id>/file` (same address, nothing leaves Eclipse), makes a sequence (`file.newSequence`), and Save runs `file.exportMedia` (H.264 to `/exports/eclipse-edit.mp4`), waits until the file stops growing, reads it with `filmcraft.readFile` and uploads it as a new video through `uploadVideo` (the normal direct upload and scan). The new video becomes the preview.
- Everything runs in the browser, single-threaded; media is never uploaded to the editor's makers. No credits are charged (it is the person's own computer doing the work).
- Tests: `tests/e2e/timeline-editor.spec.ts` (chip needs a clip, overlay, headers and wasm type, and a full Save with a real MP4 in headless Chromium on the CPU compositor).
- Limits: desktop-style Premiere-like UI (small on phones); needs WebGPU or WebGL2; exports are rendered on the person's device (long clips can be slow); the editor's own name and ArtCraft marks show inside it (their licence allows unmodified use only: do not edit the build's artwork).
- To update: rebuild from a newer FilmCraft release and replace `public/filmcraft/`. `ALL` licences in `public/filmcraft/licenses/` must stay with it.
