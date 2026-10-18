import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { detectLang } from "@/lib/i18n/geo";

// The payment webhook, the scheduled jobs and the public API / MCP endpoint are called with no browser sign-in; each authenticates itself (signature, CRON_SECRET, an API key). Terms and privacy are public pages, and so are the files search engines and link previews fetch (robots, sitemap, share picture, icons): a new public route must be added here or a signed-out visitor is sent to sign-in.
const isPublic = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)", "/sso-callback(.*)", "/api/payments/webhook", "/api/v1/(.*)", "/api/mcp", "/api/locale", "/api/i18n/(.*)", "/api/cron/(.*)", "/terms", "/privacy", "/c/(.*)", "/p/(.*)", "/api/public/(.*)", "/robots.txt", "/sitemap.xml", "/opengraph-image(.*)", "/icon(.*)", "/apple-icon(.*)", "/manifest.webmanifest"]);

// First visit: remember the language for the visitor's country (Vercel's IP lookup header, else the browser's language) in a plain cookie, so the very first page can already be shown translated.
// An existing cookie (set earlier, or by the person's own choice in the language menu) is never overwritten. Page requests only.
function withLanguage(req: NextRequest): NextResponse | undefined {
  if (req.cookies.has("eclipse-lang") || !(req.headers.get("accept") || "").includes("text/html")) return undefined;
  const lang = detectLang(req.headers.get("x-vercel-ip-country") || req.headers.get("cf-ipcountry"), req.headers.get("accept-language"));
  const res = NextResponse.next();
  res.cookies.set("eclipse-lang", lang, { path: "/", maxAge: 30 * 24 * 3600, sameSite: "lax" });
  return res;
}

const withClerk = clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
  return withLanguage(req);
});

// No keys: preview mode, let everything through.
export default clerkEnabled ? withClerk : (req: NextRequest) => withLanguage(req) ?? NextResponse.next();

// Static files are never sign-in pages: videos and audio are on the skip list too (they were missing, so a signed-out visitor's request for /hero/hero.mp4 was redirected to sign-in and the video never loaded).
export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp4|webm|mov|m4v|mp3|ogg|wav|avif)).*)", "/(api|trpc)(.*)", "/__clerk/:path*"],
};
