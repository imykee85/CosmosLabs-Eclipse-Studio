// Models the Connect assistant can really run on. Every entry here is served through our AI provider (ANTHROPIC_API_KEY); user-facing names are Core's own;
// names that cannot be reached from this server are not listed. `api` is the model id sent to the API; Auto picks the default.
export type ConnectModel = { id: string; name: string; blurb?: string; vendor: string; tag?: string; featured?: boolean; api: string };

export const connectModels: ConnectModel[] = [
  { id: "auto", name: "Auto", blurb: "Core's recommended model for everyday work", vendor: "Core", tag: "Recommended", featured: true, api: "claude-sonnet-5-5" },
  { id: "claude-opus-5-5", name: "Core Max", blurb: "Deepest thinking for big concepts and hard problems. Uses more credits (about 2x Pro)", vendor: "Core", featured: true, api: "claude-opus-5-5" },
  { id: "claude-sonnet-5-5", name: "Core Pro", blurb: "Balanced speed and quality for everyday work. Standard credit use", vendor: "Core", featured: true, api: "claude-sonnet-5-5" },
  { id: "claude-haiku-5-5", name: "Core Lite", blurb: "Fastest, for quick answers and small edits. Uses very few credits", vendor: "Core", featured: true, api: "claude-haiku-5-5" },
];

export const MODEL_KEY = "eclipse-connect-model";
/** Fired when something other than the chip changes the choice (Atlas), so the chip shows it. */
export const MODEL_EVENT = "eclipse-connect-model-changed";

/** The API model id for a picker choice; anything unknown falls back to Auto. */
export const apiModelFor = (id: unknown): string => (connectModels.find((m) => m.id === id) ?? connectModels[0]).api;
