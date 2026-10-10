/** @type {import('next').NextConfig} */
const nextConfig = {
  // Design-mockup logos on the landing strip: shown locally and on preview deployments, never in production.
  env: { NEXT_PUBLIC_MOCK_LOGOS: process.env.VERCEL_ENV === "production" ? "0" : "1" },
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
};

export default nextConfig;
