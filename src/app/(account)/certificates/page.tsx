import { Award } from "lucide-react";
import "@/components/library/library.css";

export default function CertificatesPage() {
  return (
    <div className="ws-ing">
      <h1>Certificates</h1>
      <p>Timestamped records that tie each creation to you, a supporting proof of origin for your work.</p>
      <div className="lib-empty" style={{ marginTop: 0 }}>
        <Award size={42} strokeWidth={1.4} aria-hidden="true" />
        <h2>No certificates yet</h2>
        <p>Open a finished project and choose “Get certificate” to create one.</p>
      </div>
    </div>
  );
}
