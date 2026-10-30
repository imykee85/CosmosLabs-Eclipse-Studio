import type { Metadata } from "next";
import AboutPage from "@/components/about/AboutPage";

export const metadata: Metadata = {
  title: "Why Eclipse — Eclipse",
  description: "Eclipse brings images, video, voice and AI agents into one creative studio, so an idea can go from a sentence to finished work.",
};

export default function Page() {
  return <AboutPage />;
}
