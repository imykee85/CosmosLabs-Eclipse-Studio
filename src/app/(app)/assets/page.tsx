import { FolderOpen } from "lucide-react";

export default function AssetsPage() {
  return (
    <div className="ws-ing">
      <h1>Assets</h1>
      <p>Reference photos for your projects. Upload them once and reuse them in every generation.</p>
      <div className="ws-kinds" style={{ gridTemplateColumns: "minmax(0, 520px)" }}>
        <div className="ws-kind is-soon" aria-disabled="true" style={{ minHeight: 0 }}>
          <span className="ws-card-icon"><FolderOpen size={20} /></span>
          <h2>No assets yet</h2>
          <p>Uploading product shots, faces and other references is coming soon.</p>
          <em className="ws-soon">Soon</em>
        </div>
      </div>
    </div>
  );
}
