import { notFound } from "next/navigation";

// The About page is switched off: "Why Eclipse?" on the homepage now opens a film instead. The page itself is kept, unlinked,
// in src/components/about/ (AboutPage.tsx, AboutCta.tsx, about.css). To bring it back, render <AboutPage /> here again,
// restore the sitemap entry and add the link back in Landing.tsx.
export default function Page() {
  notFound();
}
