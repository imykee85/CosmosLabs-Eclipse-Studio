import type { AudioModel } from "../registry";
import type { AudioProvider, ProviderCtx } from "../types";
import { elevenlabs } from "./elevenlabs";
import { fake } from "./fake";

const PROVIDERS: Record<AudioModel["provider"], AudioProvider> = { elevenlabs, fake };

export const providerFor = (m: AudioModel): AudioProvider => PROVIDERS[m.provider];

// The key and base address for a provider, from env (Secrets: ELEVENLABS_API_KEY; Config: ELEVENLABS_BASE_URL). Null when the key is not set:
// a model whose provider has no key is hidden and refused.
export function ctxFor(m: AudioModel): ProviderCtx | null {
  if (m.provider === "fake") return process.env.AUDIO_FAKE_URL ? { apiKey: "fake", baseUrl: process.env.AUDIO_FAKE_URL } : null;
  if (m.provider === "elevenlabs") {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    return apiKey ? { apiKey, baseUrl: (process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io").replace(/\/+$/, "") } : null;
  }
  return null;
}

export const modelAvailable = (m: AudioModel) => ctxFor(m) !== null;
