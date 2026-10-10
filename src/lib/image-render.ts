import type { PublicModel } from "@/lib/models";

// The shared brains of "make images from a prompt": used by Image Studio and by the Canvas image generator, so the two behave the same.

// Quality tiers on offer. A model takes the ones it can render: 1K and 2K and 4K by name, and Soul's 720p and 1080p
// stand in for 1K and 1.5K. Tiers a model cannot make are greyed out rather than guessed.
export const TIERS = [{ id: "1k", label: "1K" }, { id: "1.5k", label: "1.5K" }, { id: "2k", label: "2K" }, { id: "4k", label: "4K" }];
export const MAX_QTY = 4;

export function tierResolution(resolutions: string[], tier: string): string | undefined {
  if (resolutions.includes(tier)) return tier;
  if (tier === "1k" && resolutions.includes("720p")) return "720p";
  if (tier === "1.5k" && resolutions.includes("1080p")) return "1080p";
  return undefined;
}

export type RefId = { type: "upload" | "render"; id: string };
export type StartResult = { ok: boolean; error: string; id?: string; seed?: number; note?: string };

export type StartInput = {
  models: PublicModel[];
  model: PublicModel;       // the chosen model (when `auto`, a fallback)
  auto: boolean;            // Auto: every image gets its own pick from the models that fit
  prompt: string;
  ratio: string;
  tier: string;
  qty: number;
  refs: RefId[];
  seedOn: boolean;
  seedNum: number | null;
  projectId?: string | null;
};

// On Auto each image gets its own pick: a model that fits the task (pictures, shape, quality), chosen at random from the tested ones (or, when none
// fits, from the rest). A specific model is used as chosen. With the seed switch on, Auto only picks models that can use the seed.
function pickFor(o: StartInput): PublicModel {
  if (!o.auto) return o.model;
  const fits = o.models.filter((m) => !m.requiresReference && m.maxReferences >= o.refs.length && m.ratios.includes(o.ratio) && (!m.resolutions.length || !!tierResolution(m.resolutions, o.tier)));
  const seeded = o.seedOn ? fits.filter((m) => m.seed.supported && (o.seedNum == null || (o.seedNum >= m.seed.min && o.seedNum <= m.seed.max))) : fits;
  const usable = seeded.length ? seeded : fits;
  const tested = usable.filter((m) => m.verified);
  const pool = tested.length ? tested : usable;
  return pool[Math.floor(Math.random() * pool.length)] ?? o.model;
}

// Start `qty` renders, each its own request, side by side. With the seed locked, image i uses seed + i (wrapping inside the model's range) so several images
// are related variations, not copies. With the switch on and no number yet, the first one goes alone so the server's seed (the last one used with that model,
// or a new one) can be reported and the others can count up from it.
export async function startImages(o: StartInput): Promise<{ results: StartResult[]; seed?: number; note?: string }> {
  let base = o.seedNum;
  const run = async (i: number): Promise<StartResult> => {
    const m = pickFor(o);
    const lock = o.seedOn && m.seed.supported;
    const seed = lock && base != null ? m.seed.min + ((base - m.seed.min + i) % (m.seed.max - m.seed.min + 1)) : undefined;
    const body = JSON.stringify({ prompt: o.prompt, aspectRatio: o.ratio, model: m.id, resolution: m.resolutions.length ? tierResolution(m.resolutions, o.tier) : undefined, projectId: o.projectId ?? undefined, references: o.refs, ...(lock ? { lockSeed: true, ...(seed != null ? { seed } : {}) } : {}) });
    const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: res.status === 503 ? "Generating is switched off in preview mode." : data.error ?? "Something went wrong. Please try again.", id: typeof data.id === "string" ? data.id : undefined, seed: typeof data.seed === "number" ? data.seed : undefined, note: typeof data.seedNote === "string" ? data.seedNote : undefined };
  };
  const results: StartResult[] = [];
  let firstSeed: number | undefined;
  if (o.seedOn && base == null && o.model.seed.supported) {
    const r0 = await run(0);
    results.push(r0);
    if (r0.ok && r0.seed != null) { base = r0.seed; firstSeed = r0.seed; }
    results.push(...await Promise.all(Array.from({ length: o.qty - 1 }, (_, i) => run(i + 1))));
  } else {
    results.push(...await Promise.all(Array.from({ length: o.qty }, (_, i) => run(i))));
  }
  return { results, seed: firstSeed, note: results.find((r) => r.note)?.note };
}
