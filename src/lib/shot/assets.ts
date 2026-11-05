// Real 3D model files the guide can use instead of its box and capsule stand-ins. Each file is in public/shot-models (shrunk by scripts/shot-models.mjs from the source files).
// When a file is missing or fails to load, the guide quietly keeps the stand-in, so a guide can always be made.
export const MODEL_FILES = {
  xbot: { file: "Xbot.glb", note: "Mannequin with idle, walk and run clips (the three.js examples' X Bot, a Mixamo character)." },
  chair: { file: "SheenChair.glb", note: "Wayfair, Sheen Chair, CC0 (Khronos glTF Sample Assets)." },
  sofa: { file: "GlamVelvetSofa.glb", note: "Wayfair, Glam Velvet Sofa, CC BY 4.0 (Khronos glTF Sample Assets). Credit: Wayfair, LLC." },
} as const;
export type ModelName = keyof typeof MODEL_FILES;
export const MODEL_NAMES = Object.keys(MODEL_FILES) as ModelName[];
/** Height in metres a furniture model is scaled to before the scene's own scale is applied. */
export const FURNITURE_HEIGHT: Record<"chair" | "sofa", number> = { chair: 0.95, sofa: 0.85 };
/** The mannequin clip that shows a pose, and how far it travels in one cycle (metres) so the feet match the ground speed. */
export const XBOT_CLIP: Record<string, { clip: string; strideM?: number }> = {
  standing: { clip: "idle" }, "hands-in-pockets": { clip: "idle" }, leaning: { clip: "idle" },
  walking: { clip: "walk", strideM: 1.4 }, running: { clip: "run", strideM: 3.2 },
};
