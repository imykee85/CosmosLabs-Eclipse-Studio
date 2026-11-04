// Skin Enhancer: one portrait comes back with natural, realistic skin and the same person. Three versions (Faithful, Creative, Flexible), a few
// sliders, and for Flexible a choice of what to optimise for. This builds the instruction for the picture-editing model. The name lives here.
export const FEATURE_NAME = "Skin Enhancer";

export type SkinVersion = "faithful" | "creative" | "flexible";
export type SkinPreset = "skin" | "everything" | "light" | "real" | "nomakeup";

export const VERSIONS: { id: SkinVersion; label: string; blurb: string }[] = [
  { id: "faithful", label: "Faithful", blurb: "Keeps the original as it is and adds natural skin texture" },
  { id: "creative", label: "Creative", blurb: "A quick, more expressive result with more clarity and contrast" },
  { id: "flexible", label: "Flexible", blurb: "A balance of true to the original and gentle improvement" },
];

export const PRESETS: { id: SkinPreset; label: string; text: string }[] = [
  { id: "skin", label: "Enhance skin", text: "Give the skin realistic, natural texture with visible pores and fine natural variation, soft realistic highlights, and no plastic or airbrushed smoothing." },
  { id: "everything", label: "Enhance everything", text: "Improve detail and definition across the whole image: skin, fabric, hair, jewellery and background texture, with natural results." },
  { id: "light", label: "Improve light", text: "Balance the lighting and tone: soften harsh backlight or rim light, even out the exposure and keep the original mood." },
  { id: "real", label: "Transform to real", text: "Convert the illustrated, 3D or doll-like character into a photorealistic person, keeping the same hairstyle, accessories, clothing, pose and framing, with realistic skin, eyes and hair." },
  { id: "nomakeup", label: "No makeup", text: "Remove the makeup (lipstick, blush, eyeshadow and the foundation look) so the skin looks bare and natural with realistic texture and tone, on the same face." },
];

export type SkinSettings = { version: SkinVersion; preset: SkinPreset; detail: number; sharpen: number; grain: number };
export const DEFAULT_SKIN: SkinSettings = { version: "flexible", preset: "skin", detail: 75, sharpen: 0, grain: 2 };

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
export const clean = (s: SkinSettings): SkinSettings => ({
  version: VERSIONS.some((v) => v.id === s.version) ? s.version : "flexible",
  preset: PRESETS.some((p) => p.id === s.preset) ? s.preset : "skin",
  detail: clamp(s.detail), sharpen: clamp(s.sharpen), grain: clamp(s.grain),
});

export function detailWords(d: number): string {
  if (d < 35) return "smooth, soft skin with only very faint texture";
  if (d < 65) return "subtle natural skin texture";
  if (d < 90) return "clearly visible natural pores and fine skin texture";
  return "pronounced, highly detailed skin texture with every pore and fine line";
}
export function sharpenWords(p: number): string {
  if (p <= 0) return "";
  if (p <= 15) return " Add a very slight sharpening of edges and fine detail.";
  if (p <= 40) return " Add moderate sharpening of edges and texture for more definition.";
  return " Add strong, crisp sharpening, but keep it looking natural, with no halos.";
}
export function grainWords(g: number): string {
  if (g <= 0) return " Leave the image clean, with no added grain.";
  if (g <= 12) return ` Keep a fine, natural film grain of about ${g} percent so the image feels real.`;
  return ` Add a visible film grain of about ${g} percent for an artistic look.`;
}

const KEEP = "Keep exactly the same person: the same face shape, age, expression, bone structure, pose, hair, clothing, background, framing and aspect ratio. Do not change the skin tone or undertone, do not lighten or darken the skin, and do not add or remove accessories. Make no sexualised changes.";

export function skinPrompt(input: SkinSettings, note = ""): string {
  const s = clean(input);
  let main: string;
  if (s.version === "creative") main = "Enhance the portrait in one step by boosting clarity, contrast and texture: more realistic skin texture, richer colour and a gentle increase in tonal depth.";
  else if (s.version === "faithful") main = `Restore the portrait very faithfully, with almost no creative change: bring back natural skin texture and colour. Skin detail level ${s.detail} out of 100: ${detailWords(s.detail)}.`;
  else main = PRESETS.find((p) => p.id === s.preset)!.text;
  const extra = note.trim() ? ` ${note.trim().slice(0, 400)}` : "";
  return `Edit image 1. ${main}${sharpenWords(s.sharpen)}${grainWords(s.grain)} ${KEEP}${extra}`;
}
