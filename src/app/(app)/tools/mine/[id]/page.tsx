import MiniToolView from "@/components/tools/MiniToolView";

export default async function MiniToolPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <MiniToolView id={params.id} />;
}
