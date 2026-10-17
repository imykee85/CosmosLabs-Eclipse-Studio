import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch as ufetch } from "undici";

// Reads the text of a public web page a person pasted (the Treatment link button). Guards against being used to reach private
// systems: http(s) only, standard ports, every address the name resolves to must be public (no loopback, private, link-local,
// carrier-grade NAT or metadata ranges), checked again on every redirect (at most 3), 8 s and 1.5 MB at most, HTML or plain text only.
const MAX_BYTES = 1_500_000;

// The connection itself also refuses private addresses (the name is resolved again at connect time), so a name that resolves to a
// public address for the check and a private one for the request (DNS rebinding) cannot get through.
const guarded = new Agent({
  connect: {
    lookup: (hostname, opts, cb) => {
      lookup(hostname, { all: true }).then((all) => {
        const ok = all.filter((a) => !isPrivateAddress(a.address));
        if (!ok.length || ok.length < all.length) return cb(new Error("private address"), "", 4);
        if ((opts as { all?: boolean } | undefined)?.all) return (cb as unknown as (e: null, a: typeof ok) => void)(null, ok);
        cb(null, ok[0].address, ok[0].family);
      }, (err) => cb(err, "", 4));
    },
  },
});
const TIMEOUT_MS = 8000;

function privateV4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}
function privateV6(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("::ffff:")) return privateV4(v.slice(7));
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v);
}
export const isPrivateAddress = (ip: string) => (isIP(ip) === 6 ? privateV6(ip) : isIP(ip) === 4 ? privateV4(ip) : true);

export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error("That is not a web address."); }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Only http and https links can be read.");
  if (u.username || u.password) throw new Error("Links with a user name or password cannot be read.");
  if (u.port && u.port !== "80" && u.port !== "443") throw new Error("Only links on the standard web ports can be read.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new Error("That address is not a public web page.");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new Error("That address could not be found.");
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new Error("That address is not a public web page.");
  return u;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function htmlToText(html: string): { title: string; text: string } {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const body = html
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e: string) => e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e.toLowerCase()] ?? m)
    .replace(/[ \t\f\v]+/g, " ").replace(/\s*\n\s*/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { title: title.replace(/&(\w+);/g, (m, e: string) => ENTITIES[e.toLowerCase()] ?? m), text: body };
}

/** The title and readable text of a public page (text cut to `maxChars`). Throws an Error with a plain message. */
export async function fetchPageText(raw: string, maxChars = 12000): Promise<{ url: string; title: string; text: string }> {
  let u = await assertPublicUrl(raw);
  for (let hop = 0; hop <= 3; hop++) {
    const res = await ufetch(u, { dispatcher: guarded, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": "EclipseStudio/1.0 (+link reader)", Accept: "text/html,text/plain;q=0.9" } }).catch(() => null);
    if (!res) throw new Error("The page could not be reached.");
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      u = await assertPublicUrl(new URL(res.headers.get("location")!, u).toString());
      continue;
    }
    if (!res.ok) throw new Error(`The page answered with an error (${res.status}).`);
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml/i.test(type)) throw new Error("That link is not a web page (only HTML and plain text can be read).");
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel().catch(() => {}); break; }
      chunks.push(value);
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    const { title, text } = /html/i.test(type) ? htmlToText(raw) : { title: "", text: raw.trim() };
    if (!text) throw new Error("The page has no readable text.");
    return { url: u.toString(), title, text: text.slice(0, maxChars) };
  }
  throw new Error("The page redirected too many times.");
}
