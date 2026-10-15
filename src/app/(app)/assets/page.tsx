import UploadPanel from "@/components/uploads/UploadPanel";

export default function AssetsPage() {
  return (
    <div className="ws-ing ws-assets">
      <h1 className="pg-title">Assets</h1>
      <p>Reference photos for your projects. Upload them once and reuse them in every generation.</p>
      <UploadPanel show="asset" addKinds={["asset"]} addLabel="Upload asset" empty={{ title: "No assets yet", copy: "Product shots, faces and other references you upload will appear here." }} />
    </div>
  );
}
