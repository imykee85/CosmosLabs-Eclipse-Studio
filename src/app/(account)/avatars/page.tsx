import { User } from "lucide-react";

export default function AvatarsPage() {
  return (
    <div className="ws-ing">
      <h1>Avatars</h1>
      <p>Create reusable people for your content and keep them consistent across every project.</p>
      <div className="ws-kinds" style={{ gridTemplateColumns: "minmax(0, 520px)" }}>
        <div className="ws-kind is-soon" aria-disabled="true" style={{ minHeight: 0 }}>
          <span className="ws-card-icon"><User size={20} /></span>
          <h2>No avatars yet</h2>
          <p>Building and saving avatars is coming soon.</p>
          <em className="ws-soon">Soon</em>
        </div>
      </div>
    </div>
  );
}
