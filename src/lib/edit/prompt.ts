// Edit and Retouch: the image editor's words. The person's own text is shown in the editor; this wraps it behind the scenes with a block that names what must NOT change
// (a good edit prompt says what stays), turns pins and selections into instructions, and says what to take from a reference picture. The names live here.
export const EDIT_NAME = "Edit";
export const RETOUCH_NAME = "Retouch";
export type EditOp = "prompt" | "visual" | "replace" | "erase";

const KEEP = "Change only what is asked. Do not change anything else: keep the subject, composition, camera angle, framing, perspective, materials, colours, reflections, other objects and any text exactly as in the picture.";

export type Pin = { x: number; y: number; text: string }; // x and y are 0..1 of the picture

const pct = (n: number) => `${Math.round(Math.min(1, Math.max(0, n)) * 100)}%`;

/** Edit, Prompt tab: the person's words plus the keep-identical block (and what to take from the reference pictures, when there are any). */
export function promptEdit(text: string, refs = 0): string {
  const ref = refs > 0 ? ` ${refs === 1 ? "The second picture is a reference" : `Pictures 2 to ${refs + 1} are references`}: take from ${refs === 1 ? "it" : "them"} only what the instruction asks for, and blend it in with the same light, perspective and style.` : "";
  return `Edit the first picture. ${text.trim()}.${ref} ${KEEP}`;
}

/** Edit, Visual tab: every pin becomes one instruction tied to a place in the picture. */
export function visualEdit(pins: Pin[], refs = 0): string {
  const lines = pins.filter((p) => p.text.trim()).map((p, i) => `${i + 1}. At the point ${pct(p.x)} from the left and ${pct(p.y)} from the top: ${p.text.trim()}.`);
  const ref = refs > 0 ? ` The extra picture${refs > 1 ? "s are references" : " is a reference"} for what to add.` : "";
  return `Edit the first picture. Make these changes, each only at its own place:\n${lines.join("\n")}${ref}\n${KEEP}`;
}

/** Retouch: the second picture is the first one with the selected area painted blue. Replace swaps what is inside it; Erase removes it and fills it in. */
export function retouchEdit(op: "replace" | "erase", text: string, refs = 0): string {
  const base = "The second picture is the first picture with the selected area painted translucent blue. Work only inside the blue area; the blue itself must not appear in the result.";
  if (op === "erase") return `${base} Remove everything inside the blue area and fill it in naturally with matching background, texture, light and perspective, as if it was never there. ${KEEP}`;
  const ref = refs > 0 ? ` Use the extra reference picture${refs > 1 ? "s" : ""} for what goes there.` : "";
  return `${base} Inside the blue area: ${text.trim()}.${ref} Match the surrounding light, perspective, colour and sharpness so the change blends in. ${KEEP}`;
}

export function problem(op: EditOp, text: string, pins: Pin[], hasSelection: boolean): string {
  if (op === "prompt" && !text.trim()) return "Write what you want to change.";
  if (op === "visual" && !pins.some((p) => p.text.trim())) return "Click on the picture and describe the change at that spot.";
  if ((op === "replace" || op === "erase") && !hasSelection) return op === "erase" ? "Draw a selection to erase." : "Draw a selection and describe what you want to change.";
  if (op === "replace" && !text.trim()) return "Describe what should replace the selection.";
  return "";
}
