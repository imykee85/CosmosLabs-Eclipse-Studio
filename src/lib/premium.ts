// Premium collections (owner 2026-11-02): the crowned cards on the dashboard. Each opens a page like Motion graphics: a grid of the owner's pictures and
// videos, and for every one the prompt behind it. The pictures and videos are visible to everyone; the PROMPTS are only given to Growth and Scale
// (feature "premium" in access-table.ts): they live in premium-prompts.ts, which only the server reads, and come through GET /api/premium/<slug>/<id>.
// TO ADD CONTENT: put the file in public/premium/<slug>/, add an entry to `premiumItems[<slug>]` below and the prompt to `premiumPrompts` under "<slug>/<id>".
export type PremiumItem = {
  id: string;          // unique inside its collection, lowercase letters, digits and hyphens
  title: string;
  kind: "image" | "video";
  src: string;         // /premium/<slug>/<file>
  poster?: string;     // a picture for a video
  ratio?: string;      // width / height, e.g. "4 / 5" (default "4 / 5")
  model?: string;      // the model it was made with, shown on its page
};

export type PremiumCollection = { slug: string; name: string; blurb: string };

export const PREMIUM_COLLECTIONS: PremiumCollection[] = [
  { slug: "art-direction", name: "Art Direction", blurb: "Art-directed images with the prompts behind them." },
  { slug: "portraits", name: "Portraits", blurb: "Portraits with the prompts behind them." },
  { slug: "interiors", name: "Interiors", blurb: "Interior images with the prompts behind them." },
  { slug: "product-shots", name: "Product shots", blurb: "Product images with the prompts behind them." },
  { slug: "beauty-shots", name: "Beauty shots", blurb: "Beauty images with the prompts behind them." },
  { slug: "filmmaking", name: "Filmmaking", blurb: "Cinematic clips with the prompts behind them." },
  { slug: "influencer-marketing", name: "Influencer Marketing", blurb: "Influencer-style clips with the prompts behind them." },
  { slug: "photography", name: "Photography", blurb: "Photographic looks with the prompts behind them." },
  { slug: "illustration", name: "Illustration", blurb: "Illustration looks with the prompts behind them." },
];

export const premiumItems: Record<string, PremiumItem[]> = {};

export const findCollection = (slug: string) => PREMIUM_COLLECTIONS.find((c) => c.slug === slug) ?? null;
export const itemsOf = (slug: string): PremiumItem[] => premiumItems[slug] ?? [];
export const findItem = (slug: string, id: string) => itemsOf(slug).find((i) => i.id === id) ?? null;
