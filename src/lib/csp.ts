// Content Security Policy, built fresh for every page request (Google's "strict CSP" recipe): a one-time random nonce marks the scripts WE put on
// the page, and 'strict-dynamic' lets those scripts load the ones they need (Clerk's sign-in, analytics). Anything else, such as a script an attacker
// slips into a page, has no nonce and the browser refuses to run it. The host lists and 'unsafe-inline' that follow are only for old browsers: a
// browser that understands nonces ignores them. Runs in the proxy (Edge), so it uses only Web APIs.
//
// CSP_MODE (Config value): "enforce" blocks, "report" (the default until the owner has used the live site) only reports what would be blocked
// to /api/csp-report, which /admin/health summarises. Switch to "enforce" when the health page shows no violations.

const CLERK = "https://*.clerk.accounts.dev https://*.clerk.com https://clerk.eclipse.cosmoslabsai.com https://accounts.eclipse.cosmoslabsai.com https://clerk-telemetry.com";
const CHALLENGE = "https://challenges.cloudflare.com";

export type CspMode = "enforce" | "report";

export function cspMode(): CspMode {
  return process.env.CSP_MODE === "enforce" ? "enforce" : "report";
}

export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // CSP3 browsers: only nonce'd scripts and what they load. Older browsers fall back to the host list and 'unsafe-inline'.
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'self' 'unsafe-inline' ${CLERK} ${CHALLENGE} https://va.vercel-scripts.com`,
    // Styles keep 'unsafe-inline': React sets style attributes everywhere, and a style cannot run code.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https://media.prompt-motion.com https://*.r2.cloudflarestorage.com",
    `connect-src 'self' ${CLERK} https://*.r2.cloudflarestorage.com https://vitals.vercel-insights.com https://va.vercel-scripts.com`,
    `frame-src 'self' ${CLERK} ${CHALLENGE}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
    "report-uri /api/csp-report",
    "report-to csp",
  ].join("; ");
}

/** Pages get the policy; API routes, share links and the mini-tool frame (which sets its own strict rules) do not. */
export function wantsCsp(pathname: string): boolean {
  return !(pathname.startsWith("/api/") || pathname.startsWith("/s/") || pathname.startsWith("/_next/"));
}

export function cspHeaders(nonce: string, mode: CspMode = cspMode()): { name: string; value: string }[] {
  const value = buildCsp(nonce);
  return [
    { name: mode === "enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only", value },
    { name: "Reporting-Endpoints", value: 'csp="/api/csp-report"' },
  ];
}
