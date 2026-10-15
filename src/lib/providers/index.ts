import { byteplus } from "./byteplus";
import { google } from "./google";
import { openai } from "./openai";
import type { SyncImageProvider } from "./types";

export type ProviderId = "higgsfield" | "google" | "openai" | "byteplus";

// The providers that answer in the same call. Higgsfield is the job-based one (see higgsfield.ts).
export function syncProvider(id: ProviderId): SyncImageProvider | null {
  return id === "google" ? google : id === "openai" ? openai : id === "byteplus" ? byteplus : null;
}

// The environment variable that must exist for a provider's models to be offered (server-side only; never sent to the browser).
export const PROVIDER_KEYS: Record<ProviderId, string | null> = { higgsfield: null, google: "GEMINI_API_KEY", openai: "OPENAI_API_KEY", byteplus: "ARK_API_KEY" };
