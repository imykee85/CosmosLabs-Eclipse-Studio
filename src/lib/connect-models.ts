// Models the Connect assistant can really run on. Every entry here is served through the Anthropic API (ANTHROPIC_API_KEY);
// names that cannot be reached from this server are not listed. `api` is the model id sent to the API; Auto picks the default.
export type ConnectModel = { id: string; name: string; blurb?: string; vendor: string; tag?: string; featured?: boolean; api: string };

export const connectModels: ConnectModel[] = [
  { id: "auto", name: "Auto", blurb: "Eclipse's recommended model for everyday work", vendor: "Eclipse", tag: "Recommended", featured: true, api: "claude-opus-5-5" },
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", blurb: "Deepest thinking for big concepts and hard problems", vendor: "Anthropic", featured: true, api: "claude-opus-5-5" },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", blurb: "Balanced speed and quality for everyday work", vendor: "Anthropic", featured: true, api: "claude-sonnet-5-5" },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", blurb: "Fastest, for quick answers and small edits", vendor: "Anthropic", featured: true, api: "claude-haiku-5-5" },
];

export const MODEL_KEY = "eclipse-connect-model";

/** The API model id for a picker choice; anything unknown falls back to Auto. */
export const apiModelFor = (id: unknown): string => (connectModels.find((m) => m.id === id) ?? connectModels[0]).api;
