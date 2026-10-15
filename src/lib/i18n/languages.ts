// Languages the app is translated into. English is the source language and never goes through the translator.
// Right-to-left languages (Arabic, Hebrew, Persian) are NOT here on purpose: the layouts have not been checked mirrored.
export type Lang = { code: string; name: string; native: string };

export const LANGS: Lang[] = [
  { code: "en", name: "English", native: "English" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "fr", name: "French", native: "Français" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "it", name: "Italian", native: "Italiano" },
  { code: "nl", name: "Dutch", native: "Nederlands" },
  { code: "pl", name: "Polish", native: "Polski" },
  { code: "tr", name: "Turkish", native: "Türkçe" },
  { code: "ru", name: "Russian", native: "Русский" },
  { code: "uk", name: "Ukrainian", native: "Українська" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
  { code: "th", name: "Thai", native: "ไทย" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "ko", name: "Korean", native: "한국어" },
  { code: "zh", name: "Chinese (Simplified)", native: "简体中文" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
];

export const LANG_CODES = LANGS.map((l) => l.code);
export const isLang = (c: unknown): c is string => typeof c === "string" && LANG_CODES.includes(c);
export const langName = (c: string) => LANGS.find((l) => l.code === c)?.name ?? "English";
