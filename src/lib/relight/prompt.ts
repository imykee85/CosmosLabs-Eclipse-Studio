// Relight: the same picture lit from somewhere else. The page places up to three lights (where it stands, its colour and strength) and this builds the
// instruction for the picture-editing model. Where a light stands uses the same angles as Change Camera: 0 degrees is in front of the subject, positive angles
// go round to the subject's right, elevation is height above (+) or below (-) the subject.
export const FEATURE_NAME = "Relight";
export const MAX_LIGHTS = 3;
export const ELEV_MIN = -90;
export const ELEV_MAX = 90;
export const INTENSITY_MAX = 10;

export type Light = { rotate: number; elevation: number; intensity: number; color: string };
export const DEFAULT_LIGHT: Light = { rotate: 0, elevation: 0, intensity: 5, color: "#ffffff" };

export const COLORS: { id: string; label: string; hex: string; text: string }[] = [
  { id: "white", label: "White", hex: "#ffffff", text: "neutral white" },
  { id: "yellow", label: "Warm yellow", hex: "#f7d96b", text: "warm yellow" },
  { id: "orange", label: "Orange", hex: "#ee7a47", text: "orange" },
  { id: "blue", label: "Blue", hex: "#5bc8f5", text: "cool blue" },
];

const wrap360 = (n: number) => ((Math.round(n) % 360) + 360) % 360;
export const clean = (l: Light): Light => ({
  rotate: wrap360(l.rotate),
  elevation: Math.max(ELEV_MIN, Math.min(ELEV_MAX, Math.round(l.elevation))),
  intensity: Math.max(0, Math.min(INTENSITY_MAX, Math.round(l.intensity))),
  color: /^#[0-9a-f]{6}$/i.test(l.color) ? l.color.toLowerCase() : "#ffffff",
});

/** Quick placements (the buttons): each sets where the chosen light stands. */
export const QUICK: { id: string; label: string; patch: (l: Light) => Partial<Light> }[] = [
  { id: "top", label: "Top", patch: (l) => ({ rotate: l.rotate, elevation: 80 }) },
  { id: "front", label: "Front", patch: () => ({ rotate: 0, elevation: 0 }) },
  { id: "right", label: "Right", patch: () => ({ rotate: 90, elevation: 0 }) },
  { id: "left", label: "Left", patch: () => ({ rotate: 270, elevation: 0 }) },
  { id: "back", label: "Back", patch: () => ({ rotate: 180, elevation: 0 }) },
  { id: "bottom", label: "Bottom", patch: (l) => ({ rotate: l.rotate, elevation: -60 }) },
];

export function sideWords(rotate: number): string {
  const a = wrap360(rotate);
  const near = (t: number) => Math.min(Math.abs(a - t), 360 - Math.abs(a - t)) <= 22.5;
  if (near(0)) return "from the front, towards the subject's face";
  if (near(45)) return "from the front and the subject's right";
  if (near(90)) return "from the subject's right side";
  if (near(135)) return "from behind and the subject's right";
  if (near(180)) return "from directly behind the subject (backlight)";
  if (near(225)) return "from behind and the subject's left";
  if (near(270)) return "from the subject's left side";
  return "from the front and the subject's left";
}
export function heightWords(e: number): string {
  if (e >= 70) return "directly overhead";
  if (e >= 25) return "high above";
  if (e > -25) return "at the subject's level";
  if (e > -70) return "from below";
  return "from directly below";
}
export function strengthWords(i: number): string {
  if (i <= 0) return "switched off";
  if (i <= 2) return "very soft and dim";
  if (i <= 4) return "soft";
  if (i <= 6) return "moderate";
  if (i <= 8) return "strong";
  return "very strong and hard";
}
export function colorWords(hex: string): string {
  const c = COLORS.find((x) => x.hex === hex.toLowerCase());
  return c ? c.text : `coloured ${hex.toLowerCase()}`;
}

const KEEP = "Keep the subject, face, hair, outfit, colours, materials, pose, composition, camera position and background shapes exactly the same as image 1. Change only the lighting: its direction, colour and strength, and the shadows, highlights and reflections they cause.";

export function relightPrompt(lights: Light[], note = ""): string {
  const ls = lights.map(clean).filter((l) => l.intensity > 0);
  const list = (ls.length ? ls : [DEFAULT_LIGHT]).map((l, i) => `${ls.length > 1 ? `Light ${i + 1}: ` : ""}a ${strengthWords(l.intensity)} ${colorWords(l.color)} light ${heightWords(l.elevation)}, ${sideWords(l.rotate)}`).join("; ");
  const extra = note.trim() ? ` ${note.trim().slice(0, 400)}` : "";
  return `Relight image 1. The scene is lit by ${list}. Remove the original lighting so only this lighting remains. ${KEEP}${extra}`;
}

/** The same lights, asked of a whole clip: the lighting changes and nothing else does. */
export function relightVideoPrompt(lights: Light[], note = ""): string {
  return relightPrompt(lights, note).replace(/^Relight image 1\./, "Relight the whole video. Keep every movement, camera move, timing, subject and sound exactly as they are.");
}
