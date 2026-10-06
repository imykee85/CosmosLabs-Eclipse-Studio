// Models shown in the Connect page model picker. The non-Claude names come from the user's reference screenshots and have NOT been
// verified or connected: before any of them is selectable for real, the backend needs a route to that provider (see
// docs/backend-design.md section 7). The Claude entries use the current model ids. Descriptions are Eclipse's own wording.
export type ConnectModel = { id: string; name: string; blurb?: string; vendor: string; tag?: string; featured?: boolean };

export const connectModels: ConnectModel[] = [
  { id: "auto", name: "Auto", blurb: "Picks the right model for each request", vendor: "Eclipse", tag: "Recommended", featured: true },
  { id: "deepseek-v4-1-flash", name: "DeepSeek V4.1 Flash", blurb: "Fast reasoning for quick iterations", vendor: "DeepSeek", tag: "New", featured: true },
  { id: "gemini-3-8-flash", name: "Gemini 3.8 Flash", blurb: "Fast and capable for long, multi-step work", vendor: "Google", tag: "New", featured: true },
  { id: "gpt-6-sol", name: "GPT 6 Sol", blurb: "Strong at planning and multi-step tasks", vendor: "OpenAI", featured: true },

  { id: "gpt-5-6-sol", name: "GPT 5.6 Sol", blurb: "Fast, strong reasoning", vendor: "OpenAI" },
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", blurb: "Deepest thinking for big concepts and hard problems", vendor: "Anthropic" },
  { id: "grok-4-6", name: "Grok 4.6", blurb: "Quick thinking for research and analysis", vendor: "xAI" },
  { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", blurb: "Fastest and lowest cost for high volume", vendor: "DeepSeek" },
  { id: "muse-spark-1-3", name: "Muse Spark 1.3", vendor: "Muse", tag: "New" },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", blurb: "Balanced speed and quality for everyday work", vendor: "Anthropic" },
  { id: "grok-4-5", name: "Grok 4.5", blurb: "Research and analysis", vendor: "xAI" },
  { id: "gpt-5-6-luna", name: "GPT 5.6 Luna", blurb: "Lightweight, for quick tasks", vendor: "OpenAI" },
  { id: "glm-5-2", name: "GLM 5.2", blurb: "Open-weight model for complex tasks", vendor: "Zhipu AI" },
  { id: "gemini-3-1-pro", name: "Gemini 3.1 Pro", blurb: "Powerful, well-rounded model", vendor: "Google" },
  { id: "gpt-5-5", name: "GPT-5.5", blurb: "Multi-step tasks", vendor: "OpenAI" },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", blurb: "Fastest, for quick answers and small edits", vendor: "Anthropic" },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", blurb: "Top quality at low cost", vendor: "DeepSeek" },
  { id: "gemini-3-0-flash", name: "Gemini 3.0 Flash", blurb: "Fast, lightweight everyday model", vendor: "Google" },
  { id: "gpt-5-2", name: "GPT 5.2", vendor: "OpenAI" },
];

export const MODEL_KEY = "eclipse-connect-model";
