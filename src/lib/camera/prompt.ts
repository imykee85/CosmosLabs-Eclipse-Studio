// Change Camera: the same subject, styling and lighting seen from a different camera position. The page sets three numbers per camera
// (rotate around the subject, vertical height, zoom) and this builds the instruction for the picture-editing model. The name lives here.
export const FEATURE_NAME = "Change Camera";

export const ROTATE_MIN = 0;
export const ROTATE_MAX = 359;
export const VERTICAL_MIN = -60;
export const VERTICAL_MAX = 80;
export const MAX_CAMERAS = 4;

export const ZOOMS = [
  { id: "initial", label: "Original", text: "keep the original framing and distance from the subject" },
  { id: "medium", label: "Medium", text: "a medium shot, a little closer than the original" },
  { id: "medium_close", label: "Medium close", text: "a medium close-up, clearly closer to the subject" },
  { id: "closer", label: "Closer", text: "a close-up, framed tight on the subject" },
  { id: "far", label: "Far", text: "a wider shot from farther away, with more of the surroundings" },
] as const;
export type ZoomId = (typeof ZOOMS)[number]["id"];
export type Cam = { rotate: number; vertical: number; zoom: ZoomId };

export const DEFAULT_CAM: Cam = { rotate: 45, vertical: 0, zoom: "initial" };

export const wrap360 = (n: number) => ((Math.round(n) % 360) + 360) % 360;
export const clampVertical = (n: number) => Math.min(VERTICAL_MAX, Math.max(VERTICAL_MIN, Math.round(n)));
export const cleanCam = (c: Cam): Cam => ({ rotate: wrap360(c.rotate), vertical: clampVertical(c.vertical), zoom: ZOOMS.some((z) => z.id === c.zoom) ? c.zoom : "initial" });

/** 0 degrees is the original view. Positive angles move the camera around the subject to the subject's right (clockwise seen from above). */
export function azimuthWords(rotate: number): string {
  const a = wrap360(rotate);
  const near = (t: number) => Math.min(Math.abs(a - t), 360 - Math.abs(a - t)) <= 22.5;
  if (near(0)) return "the original front view";
  if (near(45)) return "a front three-quarter view from the subject's right";
  if (near(90)) return "a side profile view from the subject's right";
  if (near(135)) return "a rear three-quarter view from the subject's right";
  if (near(180)) return "a back view, directly behind the subject";
  if (near(225)) return "a rear three-quarter view from the subject's left";
  if (near(270)) return "a side profile view from the subject's left";
  return "a front three-quarter view from the subject's left";
}

export function elevationWords(vertical: number): string {
  const v = clampVertical(vertical);
  if (v >= 60) return "an almost top-down view, the camera directly above looking straight down";
  if (v >= 20) return "a high angle, the camera above the subject looking down";
  if (v > -20) return "an eye-level view";
  return "a low angle, the camera below the subject looking up";
}

const KEEP = "Keep the subject, face, hair, outfit, accessories, colours, materials, lighting style, background and image style exactly the same as image 1, and keep it the same moment. Change only the camera position; shadows and reflections must follow the new camera position.";

/** The instruction for one camera. `note` is the person's optional extra words ("keep the sunglasses on"). */
export function cameraPrompt(cam: Cam, note = ""): string {
  const c = cleanCam(cam);
  const z = ZOOMS.find((x) => x.id === c.zoom)!;
  const extra = note.trim() ? ` ${note.trim().slice(0, 400)}` : "";
  return `Show the subject of image 1 from a new camera position: ${azimuthWords(c.rotate)} (the camera moved about ${c.rotate} degrees around the subject), at ${elevationWords(c.vertical)} (about ${c.vertical} degrees vertical), with ${z.text}. ${KEEP}${extra}`;
}

/** The starting positions for n cameras: spread round the ring from the base position. */
export function startCams(n: number, base: Cam = DEFAULT_CAM): Cam[] {
  const k = Math.min(MAX_CAMERAS, Math.max(1, Math.round(n)));
  return Array.from({ length: k }, (_, i) => cleanCam({ ...base, rotate: base.rotate + (360 / k) * i }));
}

/** Locked cameras move together: the change of one is added to all. Unlocked, only the chosen one moves. */
export function moveCams(cams: Cam[], index: number, next: Cam, locked: boolean): Cam[] {
  const from = cams[index];
  if (!from) return cams;
  if (!locked) return cams.map((c, i) => (i === index ? cleanCam(next) : c));
  const dr = next.rotate - from.rotate, dv = next.vertical - from.vertical;
  return cams.map((c, i) => (i === index ? cleanCam(next) : cleanCam({ ...c, rotate: c.rotate + dr, vertical: c.vertical + dv, zoom: next.zoom })));
}
