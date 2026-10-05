import LibraryView from "@/components/library/LibraryView";
import { resolveKind } from "@/lib/library";

export default function LibraryPage({ searchParams }: { searchParams: { kind?: string } }) {
  const kind = resolveKind(searchParams.kind);
  return <LibraryView key={kind} kind={kind} />;
}
