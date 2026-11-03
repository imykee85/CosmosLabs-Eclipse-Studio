// "App updates" in the notifications panel: what is new in Eclipse. Add the newest entry at the TOP. `at` is an ISO date; `href` is optional.
export type AppUpdate = { id: string; title: string; body: string; at: string; href?: string };

export const APP_UPDATES: AppUpdate[] = [
  { id: "projects-order", title: "Projects now follow your latest work", body: "The project you worked on last always comes first on the dashboard.", at: "2026-11-03T00:00:00Z", href: "/dashboard" },
  { id: "premium-collections", title: "Premium collections", body: "The crowned cards on the dashboard open collections with the prompts behind them, for Growth and Scale.", at: "2026-11-02T00:00:00Z", href: "/dashboard" },
  { id: "atlas-fashion", title: "Atlas can direct fashion campaigns", body: "Ask Atlas for a campaign concept, styling and prompts from a short brief.", at: "2026-11-01T00:00:00Z" },
];
