/** @type {import('next').NextConfig} */
const nextConfig = {
  // Design-mockup logos on the landing strip: shown locally and on preview deployments, never in production.
  env: { NEXT_PUBLIC_MOCK_LOGOS: process.env.VERCEL_ENV === "production" ? "0" : "1" },
  // Nothing uses next/image, so the image optimizer (an open fetch proxy when it allows every host) is switched off.
  images: { unoptimized: true },
};

export default nextConfig;
