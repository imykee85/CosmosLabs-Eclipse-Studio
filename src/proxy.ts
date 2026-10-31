import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { detectLang } from "@/lib/i18n/geo";
import { cspHeaders, newNonce, wantsCsp } from "@/lib/csp";
import { MEDIA_COOKIE, MEDIA_TTL, gatedMediaPath, mediaCookieLeft, mediaCookieNeedsRenewal, mediaCookieValue, mediaGateOn } from "@/lib/media-gate";

// The payment webhook, the scheduled jobs and the public API / MCP endpoint are called with no browser sign-in; each authenticates itself (signature, CRON_SECRET, an API key). Terms and privacy are public pages, and so are the files search engines and link previews fetch (robots, sitemap, share picture, icons): a new public route must be added here or a signed-out visitor is sent to sign-in.
const isPublic = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)", "/sso-callback(.*)", "/api/payments/webhook", "/api/v1/(.*)", "/api/mcp", "/.well-known/(.*)", "/oauth/(.*)", "/api/oauth/(.*)", "/api/locale", "/api/csp-report", "/api/i18n/(.*)", "/api/cron/(.*)", "/about", "/terms", "/privacy", "/c/(.*)", "/p/(.*)", "/v/(.*)", "/s/(.*)", "/api/public/(.*)", "/robots.txt", "/sitemap.xml", "/opengraph-image(.*)", "/icon(.*)", "/apple-icon(.*)", "/manifest.webmanifest"]);

// Every page request: a fresh CSP nonce (src/lib/csp.ts) goes on the request, so the page can put it on its own scripts, and the policy goes on the response.
// First visit: remember the language for the visitor's country (Vercel's IP lookup header, else the browser's language) in a plain cookie, so the very first page can already be shown translated.
// An existing cookie (set earlier, or by the person's own choice in the language menu) is never overwritten. Page requests only.
function pageResponse(req: NextRequest): NextResponse {
  const headers = new Headers(req.headers);
  const csp = wantsCsp(req.nextUrl.pathname) ? cspHeaders(newNonce()) : [];
  if (csp.length) {
    // Next.js and Clerk read the nonce from these request headers; the value after "nonce-" is the same one used in the policy.
    headers.set("content-security-policy", csp[0].value);
    headers.set("x-nonce", /'nonce-([^']+)'/.exec(csp[0].value)?.[1] ?? "");
  }
  const res = NextResponse.next({ request: { headers } });
  for (const h of csp) res.headers.set(h.name, h.value);
  if (!req.cookies.has("eclipse-lang") && (req.headers.get("accept") || "").includes("text/html")) {
    const lang = detectLang(req.headers.get("x-vercel-ip-country") || req.headers.get("cf-ipcountry"), req.headers.get("accept-language"));
    res.cookies.set("eclipse-lang", lang, { path: "/", maxAge: 30 * 24 * 3600, sameSite: "lax" });
  }
  // The signed cookie the homepage media folders ask for (src/lib/media-gate.ts): given with any page, renewed when it is nearly out.
  if (mediaGateOn() && mediaCookieNeedsRenewal(req.cookies.get(MEDIA_COOKIE)?.value)) {
    res.cookies.set(MEDIA_COOKIE, mediaCookieValue(), { path: "/", maxAge: MEDIA_TTL, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
  }
  return res;
}

const withClerk = clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
  return pageResponse(req);
});

const handler = clerkEnabled ? withClerk : (req: NextRequest) => pageResponse(req);

// The homepage media folders: no valid media cookie, no file. Everything else goes the usual way (sign-in rules, CSP, language cookie).
export default function proxy(req: NextRequest, event: NextFetchEvent) {
  if (gatedMediaPath(req.nextUrl.pathname)) {
    if (mediaGateOn() && !mediaCookieLeft(req.cookies.get(MEDIA_COOKIE)?.value)) {
      return new NextResponse("Not available.", { status: 403, headers: { "cache-control": "no-store" } });
    }
    return NextResponse.next();
  }
  return handler(req, event);
}

// The homepage media folders (/landing, /hero, /carousel) are NOT in this list any more (2026-10-31): every file request there used to start this function, dozens per homepage visit, and used up the Vercel CPU allowance while the media gate (src/lib/media-gate.ts) is off in production. To use the gate again, add "/(landing|hero|carousel)/:path*" back here (and set MEDIA_GATE=on).
// Static files are never sign-in pages: videos and audio are on the skip list too (they were missing, so a signed-out visitor's request for /hero/hero.mp4 was redirected to sign-in and the video never loaded).
export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp4|webm|mov|m4v|mp3|ogg|wav|avif)).*)", "/(api|trpc)(.*)", "/__clerk/:path*"],
};
