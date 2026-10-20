// Cheaper DIRECT routes (owner decision 2026-10-20). Most models cost the same through Higgsfield as at the maker, so they stay on Higgsfield. A few are clearly
// cheaper direct, and those get a lower credit price (same 2.5x rule). One setting per model, ROUTE_<MODEL_ID>=direct|higgsfield (a Config value, default
// higgsfield), says which route the owner wants. A model really uses the direct route only when ALL of these hold:
//   1. the setting says direct,
//   2. its maker's key is set (below), and
//   3. a direct adapter has been registered for it (registerDirectRoute) .
// Otherwise it runs, and is priced, on Higgsfield. The credit price always follows the route a render really uses, and when a direct start fails before the
// provider accepts the job the render falls back to Higgsfield and is charged the Higgsfield price (the person is shown the price before generating, and
// the Generate button asks again if the fallback price is higher than what was shown).
//
// Adapters built so far (from the owner's reference files): Qwen Image (docs/image-providers/qwen-image.md, src/lib/providers/qwen.ts) and xAI Grok Imagine
// (docs/image-providers/xai-imagine.md, src/lib/providers/xai.ts). Still waiting for its reference file, and NOT built from memory: BytePlus Seedance video
// (docs/video-providers/byteplus-seedance.md). Until an adapter exists its model resolves to "higgsfield".

export type Route = "higgsfield" | "direct";

/** The environment variable holding the maker's key for each model that has a direct route. */
export const DIRECT_KEY: Record<string, string> = {
  seedance_2_0: "ARK_API_KEY",
  seedance_2_5: "ARK_API_KEY",
  qwen_image_3: "DASHSCOPE_API_KEY",
  qwen_image_3_edit: "DASHSCOPE_API_KEY",
  grok_image_2: "XAI_API_KEY",
};

// Models whose direct adapter exists in the code.
const BUILT = new Set<string>(["qwen_image_3", "qwen_image_3_edit", "grok_image_2"]);
// Extra registrations (tests register a fake one).
const registered = new Set<string>();

/** Registers a direct adapter for a model (done by the adapter's own module; tests register a fake). */
export function registerDirectRoute(modelId: string): void { registered.add(modelId); }
export function unregisterDirectRoute(modelId: string): void { registered.delete(modelId); }

/** What the owner asked for, whether or not it can run. */
export function routeSetting(modelId: string): Route {
  return process.env[`ROUTE_${modelId.toUpperCase()}`]?.trim().toLowerCase() === "direct" ? "direct" : "higgsfield";
}

/** The route a render of this model really uses right now. */
export function routeFor(modelId: string): Route {
  if (routeSetting(modelId) !== "direct") return "higgsfield";
  const key = DIRECT_KEY[modelId];
  if (!key || !process.env[key] || !(BUILT.has(modelId) || registered.has(modelId))) return "higgsfield";
  return "direct";
}

/** Runs the direct start; if it throws before the provider accepted the job, runs the Higgsfield start instead. Returns which route started it. */
export async function startWithFallback<T>(route: Route, direct: () => Promise<T>, higgsfield: () => Promise<T>): Promise<{ route: Route; value: T }> {
  if (route === "direct") {
    try { return { route: "direct", value: await direct() }; } catch (err) { console.error("direct route failed before starting, falling back to Higgsfield", err); }
  }
  return { route: "higgsfield", value: await higgsfield() };
}
