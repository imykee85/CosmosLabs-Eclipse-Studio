import { Award } from "lucide-react";

export default function CertificatesPage() {
  return (
    <div className="ws-ing">
      <h1>Certificates</h1>
      <p>Certificates you earn as you complete Eclipse lessons will appear here.</p>
      <div className="ws-kinds" style={{ gridTemplateColumns: "minmax(0, 520px)" }}>
        <div className="ws-kind is-soon" aria-disabled="true" style={{ minHeight: 0 }}>
          <span className="ws-card-icon"><Award size={20} /></span>
          <h2>No certificates yet</h2>
          <p>Certificates are coming soon.</p>
          <em className="ws-soon">Soon</em>
        </div>
      </div>
    </div>
  );
}
