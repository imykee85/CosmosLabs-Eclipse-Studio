import MiniToolView from "@/components/tools/MiniToolView";

export default function MiniToolPage({ params }: { params: { id: string } }) {
  return <MiniToolView id={params.id} />;
}
