import { LayoutGrid } from "lucide-react";

export default function PortfolioPage() {
  return (
    <div className="ws-ing">
      <h1>Portfolio</h1>
      <p>Showcase your best work in one place and share it with clients.</p>
      <div className="ws-kinds" style={{ gridTemplateColumns: "minmax(0, 520px)" }}>
        <div className="ws-kind is-soon" aria-disabled="true" style={{ minHeight: 0 }}>
          <span className="ws-card-icon"><LayoutGrid size={20} /></span>
          <h2>Your portfolio is empty</h2>
          <p>Curating and sharing a portfolio is coming soon.</p>
          <em className="ws-soon">Soon</em>
        </div>
      </div>
    </div>
  );
}
