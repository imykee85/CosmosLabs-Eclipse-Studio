import { User } from "lucide-react";

export default function AvatarsPage() {
  return (
    <div className="ws-ing">
      <h1>Avatars</h1>
      <p>Create reusable people for your content and keep them consistent across every project.</p>
      <div className="ws-kinds" style={{ gridTemplateColumns: "minmax(0, 520px)" }}>
        <div className="ws-kind" style={{ minHeight: 0 }}>
          <span className="ws-card-icon"><User size={20} /></span>
          <h2>No avatars yet</h2>
          <p>Avatars you create will appear here.</p>
        </div>
      </div>
    </div>
  );
}
