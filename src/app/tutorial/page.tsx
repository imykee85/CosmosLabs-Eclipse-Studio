import type { Metadata } from "next";
import TutorialView from "@/components/tutorial/TutorialView";
import { resolveOrigin } from "@/lib/tutorial";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Academy", description: "Lessons and courses for getting the most out of Eclipse Studio.", robots: { index: false } };

export default async function TutorialPage(props: { searchParams: Promise<{ from?: string }> }) {
  const searchParams = await props.searchParams;
  return <TutorialView back={resolveOrigin(searchParams.from)} />;
}
