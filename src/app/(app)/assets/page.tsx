import { FolderOpen } from "lucide-react";

export default function AssetsPage() {
  return (
    <div className="ws-ing ws-assets">
      <h1>Assets</h1>
      <p>Reference photos for your projects. Upload them once and reuse them in every generation.</p>
      <div className="ws-kinds">
        <div className="ws-kind">
          <span className="ws-card-icon"><FolderOpen size={20} /></span>
          <h2>No assets yet</h2>
          <p>Product shots, faces and other references you upload will appear here.</p>
        </div>
      </div>
    </div>
  );
}
