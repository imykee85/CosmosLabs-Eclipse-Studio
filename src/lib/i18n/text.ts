// Shared by the browser runtime and the server: what counts as a translatable piece of text, and how numbers are lifted out of it.
// "3 min ago" and "12 min ago" become one string, "{0} min ago", so the translator sees (and stores) it once.

export const MAX_TEXT = 400;

/** Text worth translating: has letters, is not a code-like token, is not absurdly long (long prose is usually someone's own content). */
export function translatable(text: string): boolean {
  const t = text.trim();
  if (t.length < 2 || t.length > MAX_TEXT) return false;
  if (!/\p{L}/u.test(t)) return false;
  if (/^(https?:\/\/|www\.|\S+@\S+\.\S+$)/i.test(t)) return false;
  if (/^[\w.-]+\.(png|jpe?g|webp|mp4|mp3|wav|json|txt|md|csv|srt)$/i.test(t)) return false;
  return true;
}

/** Replaces each run of digits (with . , : separators inside) by {0}, {1}... and returns the numbers in order. */
export function lift(text: string): { template: string; nums: string[] } {
  const nums: string[] = [];
  const template = text.replace(/\d+(?:[.,:]\d+)*/g, (m) => { nums.push(m); return `{${nums.length - 1}}`; });
  return { template, nums };
}

/** Puts the numbers back. A translation that lost a placeholder is rejected (null) so English stays rather than a wrong sentence. */
export function restore(template: string, nums: string[]): string | null {
  for (let i = 0; i < nums.length; i++) if (!template.includes(`{${i}}`)) return null;
  return template.replace(/\{(\d+)\}/g, (_, n) => nums[Number(n)] ?? "");
}

/** Small, fast, stable string hash (FNV-1a, two lanes) used for the browser's own cache keys. */
export function hash(s: string): string {
  let a = 0x811c9dc5, b = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b + c + i, 0x85ebca6b) >>> 0;
  }
  return a.toString(36) + b.toString(36);
}

/** Pages whose wording must stay exactly as written (legal text: the English version governs) or is for the owner only. */
export function skipPath(pathname: string): boolean {
  return /^\/(terms|privacy|admin)(\/|$)/.test(pathname);
}

/** Names that are never translated (also told to the translator). */
export const KEEP_NAMES = [
  "Eclipse", "Eclipse Studio", "Cosmos Labs", "Cosmos Labs AI", "Atlas", "Core",
  "Soul 2", "Soul Cinema", "Seedance", "Kling", "MiniMax", "Hailuo", "Wan", "Happy Horse", "PixVerse", "Grok", "Nano Banana", "GPT Image", "Seedream", "Ideogram", "Recraft", "Qwen", "Z-Image", "Marketing Studio", "Ads Studio", "Cinema Studio", "Genjutsu", "LTX",
  "ElevenLabs", "Fish Audio", "Seed Audio", "Claude", "ChatGPT", "Gemini", "Perplexity", "Meta AI", "Telegram", "Slack", "TikTok", "Instagram", "YouTube", "Higgsfield", "Whop",
  "Image Studio", "Video Studio", "Audio Studio",
];
