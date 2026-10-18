import TutorialView from "@/components/tutorial/TutorialView";
import { resolveOrigin } from "@/lib/tutorial";

export const dynamic = "force-dynamic";

export default async function TutorialPage(props: { searchParams: Promise<{ from?: string }> }) {
  const searchParams = await props.searchParams;
  return <TutorialView back={resolveOrigin(searchParams.from)} />;
}
