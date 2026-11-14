# ShotMap rebuild: what the two reference tutorials showed and how Eclipse does it

The owner sent two Magnific Academy tutorials of their "3D Scenes" tool (a 6 min overview and a 10.5 min boat commercial walkthrough). Both were watched frame by frame with transcripts. Nothing of theirs (name, wording, pictures, assets) is copied: only the way the tool works. Eclipse's own wording throughout.

## What the reference tool does
- Start screen: start from a Virtual scene (schematic 3D set) or a Real environment (photoreal scan). Virtual sources: Prompt, Image (pick or draw), Video, None. Real sources: Image(s) with an optional prompt, a real Place on a map, Upload a .ply/.spz scan. A Templates button.
- Editor with three modes in a pill: Compose (build and arrange), Shoot (stills through a camera), Motion (camera keyframes on a timeline). Top right: Export and "Use video".
- Compose: a scene list on the left (scene card, New group, Add, cameras, floor, groups as folders, objects with a menu), an Add panel (quick Cube / Mannequin / Camera / Ask with shortcuts, Recent, tabs Objects (upload 3D model, image to 3D, own models, gallery), Characters, Shapes, Images), an inspector (Transform: position, rotation, scale with lock, dimensions, move/rotate/scale tools; Appearance), a gizmo in the view, a live camera preview in a corner, and an assistant box at the bottom.
- Shoot: viewfinder with thirds, lens and field of view top left, aperture and focus top right, a big shutter, settings for Style, Frame, Lens, Depth, a capture quality choice, and a box to describe changes; the shutter turns the grey view into a finished still.
- Motion: preview window, Add (Actor, Cube, Camera, Ask), Simple figures switch, Add keyframe (K), double-click on the timeline adds a key, camera track with keyframe diamonds, actor tracks, transport (start, previous key, play, next key, end, speed, loop), aspect, shot menu, shot duration, duplicate, delete, easing per selected key (Smooth, Linear, Ease In, Ease Out, Ease In-Out), scissors. Selecting a key opens camera settings: Enter camera, Set as active, lens, aperture, focus with a pick-in-scene button. Enter camera: look through the camera, move with the mouse, Done (Esc).
- Use video renders the move and sends it to the video generator as a motion reference for Seedance 2.5; character pictures are added as separate references and the prompt says what the grey stand-ins really are.

## How Eclipse builds it (2026-11-12)
- Data: `src/lib/shot/world.ts` (free placement, groups, cameras with keyframes, shots, item keyframes, eases, sampling, the prompt, `readWorld`).
- 3D view: `src/lib/shot/world-view.ts` (three.js: orbit, gizmo, picking, camera bodies per key and paths, live preview inset, camera-mode navigation, focus picking, depth of field).
- Recording: `src/lib/shot/world-record.ts` (in the browser with mediabunny, 24 fps, 480p or 720p, H.264 where available), then the usual video upload and hand-over to Video Studio.
- Assistant: `POST /api/shot/ask` + `src/lib/shot/ask.ts` (build from words, pictures, a drawing or video frames; edit the scene; lay out camera keys). Charged as chat, plan feature `shotmap`.
- Screens: `src/components/shot/studio/` (`ShotStudio.tsx`, `parts.tsx`, `shot-studio.css`, prefix `ss-`). Scenes saved per project in this browser (`world-store.ts`), uploaded .glb models in IndexedDB, four templates.
- Not built (Soon): Real environment (all three sources), Image to 3D, "My Styles". The reference tool's 3D model generator is a separate tool and is not part of this.
