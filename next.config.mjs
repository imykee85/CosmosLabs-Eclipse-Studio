/** @type {import('next').NextConfig} */

// Security headers for every page. The anti-framing and lock-down rules are enforced here. The script, style and connection rules (the real
// Content Security Policy, with a fresh nonce per page) are built per request in src/proxy.ts from src/lib/csp.ts.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=()" },
];

const nextConfig = {
  // Design-mockup logos on the landing strip: shown locally and on preview deployments, never in production.
  env: { NEXT_PUBLIC_MOCK_LOGOS: "1" }, // owner 2026-10-15: mock logos are allowed on every build, production included
  // Nothing uses next/image, so the image optimizer (an open fetch proxy when it allows every host) is switched off.
  images: { unoptimized: true },
  // Atlas's video watching runs ffmpeg: keep its binary out of the bundle and make sure it is shipped with that one route.
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg", "@vercel/sandbox"],
  // sharp ships a WebAssembly copy as a fallback for platforms without its native build; Vercel's Linux uses the native one, so the 9 MB copy is left out.
  outputFileTracingExcludes: { "**/*": ["./node_modules/@img/sharp-wasm32/**"] },
  outputFileTracingIncludes: {
    ...Object.fromEntries(["/api/agent/chat", "/api/uploads/direct/finish"].map((r) => [r, ["./node_modules/@ffmpeg-installer/ffmpeg/**", "./node_modules/@ffmpeg-installer/linux-x64/**"]])),
  },
  async headers() {
    // A person's browser mini tool is shown in a locked-down frame on Eclipse's own pages, so its address is the one page that may be framed
    // (by Eclipse only); that route sets its own strict rules (src/app/api/core/tools/[id]/frame/route.ts).
    return [{ source: "/((?!api/core/tools/[^/]+/frame$).*)", headers: securityHeaders }];
  },
};

export default nextConfig;
