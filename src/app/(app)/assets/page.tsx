import AssetsView from "@/components/uploads/AssetsView";

export default function AssetsPage() {
  return (
    <div className="ws-ing ws-assets">
      <h1 className="pg-title">Assets</h1>
      <p>Pictures, videos and sounds for your projects. Upload them once and reuse them in every studio.</p>
      <AssetsView />
    </div>
  );
}
