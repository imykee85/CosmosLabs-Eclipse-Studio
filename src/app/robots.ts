import type { MetadataRoute } from "next";

// Search engines may read the public site only: the landing page and the legal pages. The app, the sign-in screens and the API are off limits,
// and nothing at all is indexed outside production (preview deployments).
const site = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export default function robots(): MetadataRoute.Robots {
  const live = !process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production";
  if (!live) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: ["/", "/terms", "/privacy"], disallow: ["/api/", "/dashboard", "/create", "/generate", "/gallery", "/library", "/assets", "/ingredients", "/canvas", "/connect", "/memory", "/skills", "/tools", "/agents", "/prompts", "/treatment", "/project", "/settings", "/portfolio", "/certificates", "/avatars", "/admin", "/motion", "/onboarding", "/tutorial", "/sign-in", "/sign-up", "/sso-callback"] },
    sitemap: `${site}/sitemap.xml`,
  };
}
