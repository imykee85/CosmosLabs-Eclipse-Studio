/** @type {import('next').NextConfig} */

// Security headers for every page. The anti-framing and lock-down rules are enforced. The full script and style rules run in REPORT-ONLY mode first:
// they could not be tried against the real sign-in (Clerk) here, so a mistake must not lock people out. Watch the browser console for
// "Content-Security-Policy-Report-Only" messages on a preview, fix the list, then switch the second header to enforcing.
// Debt: Next.js needs 'unsafe-inline' for its own scripts until nonces are added.
// When you add your own domain, Clerk serves from clerk.<your domain>: add it here (report-only first, so nothing breaks).
const clerk = "https://*.clerk.accounts.dev https://*.clerk.com";
const reportOnlyCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${clerk} https://challenges.cloudflare.com https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https://media.prompt-motion.com https://*.r2.cloudflarestorage.com",
  `connect-src 'self' ${clerk} https://*.r2.cloudflarestorage.com https://vitals.vercel-insights.com`,
  `frame-src ${clerk} https://challenges.cloudflare.com`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
  { key: "Content-Security-Policy-Report-Only", value: reportOnlyCsp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig = {
  // Design-mockup logos on the landing strip: shown locally and on preview deployments, never in production.
  env: { NEXT_PUBLIC_MOCK_LOGOS: "1" }, // owner 2026-10-15: mock logos are allowed on every build, production included
  // Nothing uses next/image, so the image optimizer (an open fetch proxy when it allows every host) is switched off.
  images: { unoptimized: true },
  // Atlas's video watching runs ffmpeg: keep its binary out of the bundle and make sure it is shipped with that one route.
  experimental: {
    serverComponentsExternalPackages: ["@ffmpeg-installer/ffmpeg", "@vercel/sandbox"],
    outputFileTracingIncludes: {
      ...Object.fromEntries(["/api/agent/chat", "/api/uploads/direct/finish"].map((r) => [r, ["./node_modules/@ffmpeg-installer/ffmpeg/**", "./node_modules/@ffmpeg-installer/linux-x64/**"]])),
    },
  },
  async headers() {
    // A person's browser mini tool is shown in a locked-down frame on Eclipse's own pages, so its address is the one page that may be framed
    // (by Eclipse only); that route sets its own strict rules (src/app/api/core/tools/[id]/frame/route.ts).
    return [{ source: "/((?!api/core/tools/[^/]+/frame$).*)", headers: securityHeaders }];
  },
};

export default nextConfig;
