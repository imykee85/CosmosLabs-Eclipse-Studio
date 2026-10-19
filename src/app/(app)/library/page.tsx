import LibraryView from "@/components/library/LibraryView";
import { resolveKind } from "@/lib/library";

export default async function LibraryPage(props: { searchParams: Promise<{ kind?: string }> }) {
  const searchParams = await props.searchParams;
  const kind = resolveKind(searchParams.kind);
  return <LibraryView key={kind} kind={kind} />;
}
