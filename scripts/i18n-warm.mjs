// Build step: make sure every language has a translation of every interface string BEFORE visitors arrive, so nobody ever waits for a translation.
// Reads the strings written in the code (src/lib/i18n/manifest.json, made by i18n-extract.mjs), asks Claude Haiku for the ones the database does not have yet and stores them
// (table `translations`). Strings already stored are skipped, so after the first build this only translates new or changed wording.
// Never fails the build: no database or key, a rate limit or the time budget just leave the rest to the background completion in /api/i18n/<lang> and the owner page /admin/translations.
// Settings (Config values): I18N_BUILD_WARM=off skips it; I18N_BUILD_BUDGET_MIN (default 12) is the most minutes it may take; I18N_BUILD_LANGS=es,pt limits the languages.
import { LANG_CODES } from "../src/lib/i18n/languages.ts";

// Off by default (2026-10-28): every build used to read the whole translations table from Neon, which used up the monthly network
// transfer. New wording is now translated on demand (the /api/i18n/<lang> route completes a language in the background, and
// /admin/translations has "Translate every language"). Set I18N_BUILD_WARM=on (Config value) to run it on a build again.
if (process.env.I18N_BUILD_WARM !== "on") { console.log("i18n warm: skipped (set I18N_BUILD_WARM=on to translate during the build)"); process.exit(0); }
if (!process.env.DATABASE_URL || !process.env.ANTHROPIC_API_KEY || process.env.TRANSLATE_KILL_SWITCH === "1") { console.log("i18n warm: skipped (needs DATABASE_URL and ANTHROPIC_API_KEY)"); process.exit(0); }

const budgetMs = (Number(process.env.I18N_BUILD_BUDGET_MIN) || 12) * 60_000;
const started = Date.now();
const langs = (process.env.I18N_BUILD_LANGS ? process.env.I18N_BUILD_LANGS.split(",") : LANG_CODES).filter((l) => l !== "en");

try {
  const { warmLanguage, translationCounts, manifestSize } = await import("../src/lib/i18n/translate-server.ts");
  const have = await translationCounts();
  const todo = langs.filter((l) => (have[l] ?? 0) < manifestSize);
  console.log(`i18n warm: ${manifestSize} strings, ${todo.length} of ${langs.length} languages incomplete`);
  let next = 0;
  const worker = async () => {
    while (next < todo.length && Date.now() - started < budgetMs) {
      const lang = todo[next++];
      let added = 0;
      for (;;) {
        if (Date.now() - started > budgetMs) { console.log(`i18n warm: ${lang} paused (time budget)`); break; }
        const r = await warmLanguage(lang, 240);
        added += r.added;
        if (!r.remaining) { console.log(`i18n warm: ${lang} complete`); break; }
        if (!r.added) { console.log(`i18n warm: ${lang} made no progress, ${r.remaining} left`); break; }
      }
    }
  };
  await Promise.all(Array.from({ length: 3 }, worker)); // three languages at a time
  console.log(`i18n warm: done in ${Math.round((Date.now() - started) / 1000)} s`);
} catch (e) {
  console.warn("i18n warm: stopped by an error, the build continues:", e instanceof Error ? e.message : e);
}
process.exit(0);
