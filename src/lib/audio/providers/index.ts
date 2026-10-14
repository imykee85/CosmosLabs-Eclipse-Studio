import type { AudioModel, AudioProviderId } from "../registry";
import type { AudioProvider, ProviderCtx } from "../types";
import { elevenlabs } from "./elevenlabs";
import { fake } from "./fake";
import { fish } from "./fish";
import { minimax } from "./minimax";
import { qwen } from "./qwen";
import { seed } from "./seed";

const PROVIDERS: Record<AudioProviderId, AudioProvider> = { elevenlabs, fish, minimax, qwen, seed, fake };

export const providerFor = (m: AudioModel): AudioProvider => PROVIDERS[m.provider];
export const providerById = (id: AudioProviderId): AudioProvider => PROVIDERS[id];

// Each provider's key (Secret) and base address (Config value, with the documented default). A provider whose key is not set is "not connected":
// its models show in the menu but Generate is refused with a plain message.
const ENV: Record<Exclude<AudioProviderId, "fake">, { key: string; base: string; def: string }> = {
  elevenlabs: { key: "ELEVENLABS_API_KEY", base: "ELEVENLABS_BASE_URL", def: "https://api.elevenlabs.io" },
  fish: { key: "FISH_API_KEY", base: "FISH_BASE_URL", def: "https://api.fish.audio" },
  minimax: { key: "MINIMAX_API_KEY", base: "MINIMAX_BASE_URL", def: "https://api.minimax.io" },
  qwen: { key: "DASHSCOPE_API_KEY", base: "DASHSCOPE_BASE_URL", def: "https://dashscope-intl.aliyuncs.com" },
  seed: { key: "BYTEPLUS_VOICE_API_KEY", base: "BYTEPLUS_VOICE_BASE_URL", def: "https://voice.ap-southeast-1.bytepluses.com/api/v3" },
};
export const keyNameFor = (p: AudioProviderId) => (p === "fake" ? "AUDIO_FAKE_URL" : ENV[p].key);

export const ctxFor = (m: AudioModel): ProviderCtx | null => ctxForProvider(m.provider);

export function ctxForProvider(provider: AudioProviderId): ProviderCtx | null {
  if (provider === "fake") return process.env.AUDIO_FAKE_URL ? { apiKey: "fake", baseUrl: process.env.AUDIO_FAKE_URL } : null;
  const e = ENV[provider];
  const apiKey = process.env[e.key];
  return apiKey ? { apiKey, baseUrl: (process.env[e.base] || e.def).replace(/\/+$/, "") } : null;
}

export const modelAvailable = (m: AudioModel) => ctxFor(m) !== null;
