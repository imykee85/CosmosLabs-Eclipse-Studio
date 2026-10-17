import type { PublicModel } from "@/lib/models";

// Image Studio's picture tools (Upscale, Remove background, Relight, Change camera). Each is an EDIT: the picture goes in as the
// only ingredient, with a fixed instruction, to the best picture-editing model this account can run, and comes back as a new
// image in the same aspect ratio ("auto" follows the first ingredient). Nothing is changed in place: the original stays.
export type ToolId = "upscale" | "removebg" | "relight" | "camera";
export type ToolOption = { id: string; label: string; text: string };

export const RELIGHT: ToolOption[] = [
  { id: "golden", label: "Golden hour", text: "warm, low golden-hour sunlight from the side with long soft shadows" },
  { id: "studio", label: "Studio softbox", text: "clean studio lighting from a large softbox at 45 degrees, soft shadows, even exposure" },
  { id: "noir", label: "Dramatic", text: "dramatic low-key lighting, a single hard key light, deep shadows and strong contrast" },
  { id: "neon", label: "Neon night", text: "night-time lighting from colourful neon signs, magenta and cyan reflections" },
  { id: "overcast", label: "Overcast", text: "soft, diffuse overcast daylight with gentle, almost shadowless light" },
  { id: "rim", label: "Rim light", text: "a strong rim light from behind that outlines the subject, darker front fill" },
];

export const CAMERA: ToolOption[] = [
  { id: "close", label: "Close-up", text: "a close-up shot, framed tight on the main subject" },
  { id: "wide", label: "Wide shot", text: "a wide shot that shows the whole subject and much more of the surroundings" },
  { id: "low", label: "Low angle", text: "a low-angle shot, camera near the ground looking up at the subject" },
  { id: "high", label: "High angle", text: "a high-angle shot, camera above looking down at the subject" },
  { id: "top", label: "Top-down", text: "a top-down overhead shot, camera directly above" },
  { id: "side", label: "Side profile", text: "a side view, camera moved 90 degrees around the subject" },
  { id: "back", label: "From behind", text: "a view from behind the subject, camera moved 180 degrees around it" },
];

const KEEP = "Keep the same subject, identity, faces, clothing, products, colours, text and style exactly as they are.";

export function toolPrompt(tool: ToolId, option?: ToolOption): string {
  switch (tool) {
    case "upscale":
      return "Recreate image 1 at a higher resolution, as a faithful upscale. Keep the composition, framing, subject, faces, colours, lighting and any text identical; only make it sharper with finer, cleaner detail and no noise or artefacts. Do not add, remove or move anything.";
    case "removebg":
      return `Remove the background of image 1 completely. Keep the main subject exactly as it is (same pose, edges, colours, details and size in the frame) and place it on a plain, pure white background (#FFFFFF) with no shadow, no floor and no other objects. ${KEEP}`;
    case "relight":
      return `Relight image 1 with ${option?.text ?? "new lighting"}. Change only the lighting, shadows and reflections. Keep the composition and camera position unchanged. ${KEEP}`;
    case "camera":
      return `Show the scene of image 1 as ${option?.text ?? "a new camera angle"}. Change only the camera position, angle and framing; it must look like the same moment photographed again. ${KEEP}`;
  }
}

export const TOOL_LABEL: Record<ToolId, string> = { upscale: "Upscale", removebg: "Remove background", relight: "Relight", camera: "Change camera" };

// Best editing models first (strongest at keeping identity and detail while following an instruction).
const ORDER = ["nano_banana_pro", "gpt_image_2_5_sunburst", "gpt_image_2_5_flare", "gpt_image_2", "seedream_5_pro", "nano_banana_2", "nano_banana_2_1", "qwen_image_3_edit", "seedream_5_flash", "seedream_4_5", "grok_image_2", "gpt_image_1_5", "ads_studio"];

/** The model a tool uses: the first editing model on the list this account can run, else any model that takes a picture. Upscale prefers one that makes 4K. */
export function toolModel(models: PublicModel[], tool: ToolId): PublicModel | null {
  const usable = models.filter((m) => m.maxReferences >= 1);
  const ranked = [...ORDER.map((id) => usable.find((m) => m.id === id)).filter((m): m is PublicModel => !!m), ...usable.filter((m) => !ORDER.includes(m.id))];
  if (tool === "upscale") return ranked.find((m) => m.resolutions.includes("4k")) ?? ranked.find((m) => m.resolutions.includes("2k")) ?? ranked[0] ?? null;
  return ranked[0] ?? null;
}

/** The quality tier a tool asks for: the highest the model makes for Upscale, else 2K where offered (a tool result should not be smaller than the picture). */
export function toolTier(m: PublicModel, tool: ToolId): string {
  const r = m.resolutions;
  if (tool === "upscale") return r.includes("4k") ? "4k" : r.includes("2k") ? "2k" : r.includes("1080p") ? "1.5k" : "1k";
  return r.includes("2k") ? "2k" : r.includes("1080p") ? "1.5k" : "1k";
}
