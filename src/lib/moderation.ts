// A first line of defence on what people ask us to make. It is deliberately narrow: it refuses requests that sexualise
// minors, which is never allowed whatever the model would do. Everything else is left to the provider's own content
// filter (a blocked render comes back as a plain message) and to the Terms of Use. It is a safety net, not a full review system.

const MINOR = /\b(child|children|kid|kids|minor|minors|underage|under[\s-]?age|preteen|pre[\s-]?teen|toddler|infant|schoolboy|schoolgirl|school\s?(boy|girl)|loli|lolita|shota|teen|teens|teenager|teenage|(1[0-7]|[0-9])[\s-]?(yo|y\/o|years?[\s-]?old))\b/i;
const SEXUAL = /\b(nude|nudes|naked|nsfw|porn|porno|pornographic|sex|sexual|erotic|explicit|topless|genitals?|fetish|hentai|undress(ed|ing)?)\b/i;

export type ModerationResult = { ok: true } | { ok: false; reason: string };

const REFUSAL = "Eclipse can't make this. Content that sexualises minors is never allowed. See the Terms of Use.";

// Accents, capitals and stray symbols should not hide a word from the patterns.
function normalise(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9\s/-]/g, " ").replace(/\s+/g, " ");
}

export function checkPrompt(prompt: string): ModerationResult {
  const text = normalise(prompt);
  return MINOR.test(text) && SEXUAL.test(text) ? { ok: false, reason: REFUSAL } : { ok: true };
}
