import Link from "next/link";
import { ArrowRight, Camera, Clapperboard } from "lucide-react";

export default function ProjectHome() {
  return (
    <div className="ws-choose">
      <h1>What are we creating?</h1>
      <p>Pick a studio. Everything you make is saved to your gallery, and you can switch studios any time from the menu on the left.</p>
      <div className="ws-cards">
        <Link href="/create" className="ws-card">
          <span className="ws-card-icon"><Camera size={20} /></span>
          <h2>Photo</h2>
          <p>Premium stills from a single prompt. Write it, generate it, keep it in your gallery.</p>
          <span className="ws-card-cta">Start <ArrowRight size={15} /></span>
        </Link>
        <button type="button" className="ws-card ws-card-btn">
          <span className="ws-card-icon"><Clapperboard size={20} /></span>
          <h2>Video</h2>
          <p>Plan scenes, write prompts, generate clips and export a finished video.</p>
          <span className="ws-card-cta">Start <ArrowRight size={15} /></span>
        </button>
      </div>
    </div>
  );
}
