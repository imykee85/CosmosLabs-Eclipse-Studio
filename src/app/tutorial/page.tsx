import TutorialView from "@/components/tutorial/TutorialView";
import { resolveOrigin } from "@/lib/tutorial";

export const dynamic = "force-dynamic";

export default function TutorialPage({ searchParams }: { searchParams: { from?: string } }) {
  return <TutorialView back={resolveOrigin(searchParams.from)} />;
}
