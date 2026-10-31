// WHO CAN USE WHAT (owner decisions 2026-10-21). One table, safe for the browser and the server: the plan cards, the locks and the server checks all read it.
// Free = 2 free images and nothing else. Every plan includes the one before it. A feature a plan does not include is still SHOWN, and the first use opens
// the upgrade pop-up (src/components/SubscribeAlert.tsx); the server refuses it with HTTP 402 and code "UPGRADE" (src/lib/access.ts).
export type PlanId = "free" | "starter" | "growth" | "scale";
export const PLAN_RANK: Record<PlanId, number> = { free: 0, starter: 1, growth: 2, scale: 3 };
export const PLAN_NAME: Record<PlanId, string> = { free: "Free", starter: "Starter", growth: "Growth", scale: "Scale" };

export type Feature = "studios" | "plan_tools" | "certificates" | "portfolio" | "api" | "teams" | "atlas" | "canvas" | "agents" | "core" | "builds" | "workflows";

/** The cheapest plan that includes each feature. */
export const FEATURE_MIN: Record<Feature, PlanId> = {
  studios: "starter",      // making video and audio (images: Free has its 2 free ones, then credits decide)
  plan_tools: "starter",   // Treatment and Prompts
  certificates: "starter",
  portfolio: "starter",
  api: "starter",          // API and MCP keys
  teams: "starter",
  atlas: "starter",        // Starter has a daily allowance (ATLAS_DAILY_STARTER below); Growth and Scale have no limit
  canvas: "growth",
  agents: "growth",        // your own agents
  core: "growth",          // chat, skills, tools, memory, connectors
  builds: "scale",         // build-with-Core (cloud computer)
  workflows: "scale",      // automated workflows: NOT built yet, shown as Soon
};

export const FEATURE_LABEL: Record<Feature, string> = {
  studios: "Video and Audio Studios",
  plan_tools: "Treatment and Prompts", certificates: "Certificates", portfolio: "Portfolio", api: "API and MCP access", teams: "Teams",
  atlas: "Atlas", canvas: "Canvas", agents: "Your own agents", core: "Core", builds: "Building tools with Core", workflows: "Automated workflows",
};

export const planAllows = (plan: PlanId, feature: Feature): boolean => PLAN_RANK[plan] >= PLAN_RANK[FEATURE_MIN[feature]];

/** The plan names that include a feature, as a sentence: "Growth and Scale", "Scale" or "every paid plan". */
export function plansFor(feature: Feature): string {
  const min = FEATURE_MIN[feature];
  if (min === "starter") return "every paid plan";
  return min === "growth" ? "the Growth and Scale plans" : "the Scale plan";
}

/** The sentence shown in the upgrade pop-up. */
export const upgradeText = (feature: Feature): string => `${FEATURE_LABEL[feature]} ${feature === "agents" || feature === "builds" || feature === "studios" ? "are" : "is"} included in ${plansFor(feature)}.`;

/** Starter's daily Atlas messages (Config value ATLAS_DAILY_MESSAGES_STARTER can change it); Growth and Scale have none. */
export const ATLAS_DAILY_STARTER_DEFAULT = 30;

/** Growth's daily Core messages (Config value CORE_DAILY_MESSAGES_GROWTH can change it); Scale has none. */
export const CORE_DAILY_GROWTH_DEFAULT = 150;

// The benefit list on the paid plan cards (owner 2026-10-21: every paid card lists ALL of them, the ones a plan lacks are greyed with a lock).
export type Benefit = { label: string; min: PlanId; soon?: boolean };
export const BENEFITS: Benefit[] = [
  { label: "Image, Video and Audio Studios", min: "starter" },
  { label: "Lower-cost video models", min: "starter" },
  { label: "Treatment and Prompts", min: "starter" },
  { label: "Certificates and Portfolio", min: "starter" },
  { label: "Academy", min: "starter" },
  { label: "Top up credits", min: "starter" },
  { label: "API and MCP access", min: "starter" },
  { label: "Teams", min: "starter" },
  { label: "Atlas, your creative agent (30 messages a day)", min: "starter" },
  { label: "No daily limit on Atlas", min: "growth" },
  { label: "Mid-priced video models, Seedance 2.5 at 720p", min: "growth" },
  { label: "Canvas", min: "growth" },
  { label: "Your own agents", min: "growth" },
  { label: "Core: chat, skills, tools and memory", min: "growth" },
  { label: "Every video model, 1080p and 4K", min: "scale" },
  { label: "No daily limit on Core", min: "scale" },
  { label: "Build your own tools with Core", min: "scale" },
  { label: "Automated workflows", min: "scale", soon: true },
];
