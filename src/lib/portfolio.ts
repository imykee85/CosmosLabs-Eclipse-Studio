// A portfolio: the editor's draft (what the person typed and chose), cleaned on the server, and the rules for its public address.
// Nothing here trusts the browser: every field is cut to length, links are limited to http(s), photos must be small JPEG data addresses.

export type PortfolioDraft = {
  headline: string; tagline: string; theme: "dark" | "light"; projectIds: string[];
  role: string; location: string; statement: string; about: string;
  email: string; phone: string; website: string; socials: string; services: string; clients: string;
  photos: Record<string, string>;
};

export const PHOTO_SLOTS = ["Cover", "About", "Contact"] as const;
const MAX_PHOTO_CHARS = 260_000; // a 640 px JPEG is about 60 to 120 KB as text
const MAX_PROJECTS = 30;

const RESERVED = new Set(["admin", "api", "app", "about", "p", "c", "new", "edit", "terms", "privacy", "sign-in", "sign-up", "dashboard", "eclipse", "support", "help", "login", "settings", "portfolio", "certificates", "www"]);

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/** An address is 3 to 40 lowercase letters, digits and single hyphens inside, and not one of the words the site uses itself. */
export function validSlug(slug: string): string | null {
  if (slug.length < 3 || slug.length > 40) return "The address needs 3 to 40 characters.";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return "Use only lowercase letters, numbers and single hyphens.";
  if (RESERVED.has(slug)) return "That address is reserved. Choose another.";
  return null;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\u0000/g, "").slice(0, max) : "");

export function cleanDraft(raw: unknown): PortfolioDraft {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const photos: Record<string, string> = {};
  const rp = (r.photos && typeof r.photos === "object" ? r.photos : {}) as Record<string, unknown>;
  for (const slot of PHOTO_SLOTS) {
    const p = rp[slot];
    if (typeof p === "string" && p.length <= MAX_PHOTO_CHARS && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p)) photos[slot] = p;
  }
  const ids = Array.isArray(r.projectIds) ? r.projectIds.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 64) : [];
  return {
    headline: str(r.headline, 80), tagline: str(r.tagline, 160), theme: r.theme === "light" ? "light" : "dark", projectIds: Array.from(new Set(ids)).slice(0, MAX_PROJECTS),
    role: str(r.role, 80), location: str(r.location, 80), statement: str(r.statement, 200), about: str(r.about, 3000),
    email: str(r.email, 120), phone: str(r.phone, 40), website: str(r.website, 160), socials: str(r.socials, 1000), services: str(r.services, 1500), clients: str(r.clients, 800),
    photos,
  };
}

/** A link a visitor may be sent to: http or https only (a bare "studio.com" gets https). Anything else (javascript:, data:, ...) is dropped. */
export function safeHref(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
  try { const u = new URL(withScheme); return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null; } catch { return null; }
}

export const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

/** "Name | link" lines. A line without a link is shown as text only. */
export function parseSocials(s: string): { name: string; href: string | null }[] {
  return lines(s).slice(0, 12).map((l) => { const [name, ...rest] = l.split("|"); return { name: name.trim(), href: rest.length ? safeHref(rest.join("|")) : null }; }).filter((x) => x.name);
}
