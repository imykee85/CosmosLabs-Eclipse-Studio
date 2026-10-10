// A first line of defence on what people ask us to make. It is deliberately narrow and aimed at the things our Terms of Use forbid outright:
// sexual content involving minors, sexual content of real people, forged documents and money, and material that promotes terrorism or self-harm.
// Everything else is left to the provider's own content filter (a blocked render comes back as a plain message). It is a safety net, not a full review system:
// each rule is written to refuse clear requests and to leave ordinary creative work alone, so a few things will get through and a few unusual
// phrasings may be refused; the person is told which kind of request it was so they can rephrase.

const MINOR = /\b(child|children|kid|kids|minor|minors|underage|under[\s-]?age|preteen|pre[\s-]?teen|toddler|infant|schoolboy|schoolgirl|school\s?(boy|girl)|loli|lolita|shota|teen|teens|teenager|teenage|(1[0-7]|[0-9])[\s-]?(yo|y\/o|years?[\s-]?old))\b/;
const SEXUAL = /\b(nude|nudes|naked|nsfw|porn|porno|pornographic|sex|sexual|sexy|erotic|explicit|topless|genitals?|fetish|hentai|undress(ed|ing)?|lingerie)\b/;
const REAL_PERSON = /\b(deepfake|deep fake|face ?swap|celebrity|celebrities|real person|real people|my (ex|boss|coworker|teacher|neighbou?r|classmate|sister|mother|mom|wife|girlfriend)|ex[\s-]?(girlfriend|boyfriend|wife|husband))\b/;
const FORGERY = /\b(fake|forged|counterfeit|fraudulent)\s+(passports?|ids?|identity cards?|driver'?s? licen[cs]es?|visas?|bank ?notes?|money|currency|dollar bills?|checks?|cheques?|prescriptions?)\b/;
const HARM: RegExp[] = [
  /\b(terrorist|extremist|isis|al[\s-]?qaeda|neo[\s-]?nazi)\s+(propaganda|recruit\w*|poster|flyer)\b/,
  /\b(suicide|self[\s-]?harm)\s+(method|methods|instructions|tutorial|guide)\b/,
  /\bhow\s+to\s+(kill|harm|hurt)\s+(yourself|myself)\b/,
  /\b(glorif\w+|promot\w+|celebrat\w+)\s+(suicide|self[\s-]?harm|mass shootings?|terrorism)\b/,
];

export type ModerationResult = { ok: true } | { ok: false; reason: string; category: "minors" | "real-person" | "forgery" | "harm" };

const REFUSALS = {
  minors: "Eclipse can't make this. Content that sexualises minors is never allowed. See the Terms of Use.",
  "real-person": "Eclipse can't make this. Sexual images of real people are not allowed. See the Terms of Use.",
  forgery: "Eclipse can't make forged documents or fake money. Please describe something else. See the Terms of Use.",
  harm: "Eclipse can't make content that promotes terrorism or self-harm. See the Terms of Use.",
} as const;

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s" };

// The same text in the forms people use to slip words past a filter: accents and capitals removed, odd symbols dropped, letters swapped for look-alike
// digits (n4k3d, s3x), spelled out one letter at a time (s e x, n.a.k.e.d) or stretched (seeex). Every form is checked.
function variants(text: string): string[] {
  const base = text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const plain = base.replace(/[^a-z0-9\s/'-]/g, " ").replace(/\s+/g, " ");
  const decoded = base.replace(/[0-9@$]/g, (c, i) => {
    const near = (j: number) => /[a-z]/.test(base[j] ?? "");
    return near(i - 1) || near(i + 1) ? LEET[c] : c; // only inside words, so "12 years old" stays a number
  }).replace(/[^a-z0-9\s/'-]/g, " ").replace(/\s+/g, " ");
  const squash = (t: string) => t.replace(/\b([a-z])(?:\s+[a-z]\b)+/g, (m) => m.replace(/\s+/g, ""));
  const stretch = (t: string) => t.replace(/([a-z])\1{2,}/g, "$1$1");
  const squeeze = (t: string) => t.replace(/([a-z])\1{2,}/g, "$1");
  const all = [plain, decoded, squash(plain), squash(decoded)];
  return [...new Set([...all, ...all.map(stretch), ...all.map(squeeze)])];
}

export function checkPrompt(prompt: string): ModerationResult {
  const forms = variants(prompt);
  const any = (r: RegExp) => forms.some((t) => r.test(t));
  const sexual = any(SEXUAL); // each kind of word is looked for in every form, so a stretched word and a spelled-out word can sit in one prompt
  if (sexual && any(MINOR)) return { ok: false, reason: REFUSALS.minors, category: "minors" };
  if (sexual && any(REAL_PERSON)) return { ok: false, reason: REFUSALS["real-person"], category: "real-person" };
  if (any(FORGERY)) return { ok: false, reason: REFUSALS.forgery, category: "forgery" };
  if (HARM.some(any)) return { ok: false, reason: REFUSALS.harm, category: "harm" };
  return { ok: true };
}
