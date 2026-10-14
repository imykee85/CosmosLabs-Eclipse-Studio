import Link from "next/link";
import { ArrowRight, Camera, Clapperboard } from "lucide-react";

export default function ProjectHome() {
  return (
    <div className="ws-choose">
      <h1>What are we creating?</h1>
      <p>Discover the latest frontier generative AI models for pictures and video, all in one studio.</p>
      <div className="ws-cards">
        <Link href="/create" className="ws-card">
          <span className="ws-card-icon"><Camera size={20} /></span>
          <h2>Photo</h2>
          <p>Premium stills from a single prompt. Write it, generate it, keep it in your gallery.</p>
          <span className="ws-card-cta">Start <ArrowRight size={15} /></span>
        </Link>
        <Link href="/generate" className="ws-card">
          <span className="ws-card-icon"><Clapperboard size={20} /></span>
          <h2>Video</h2>
          <p>Plan scenes, write prompts, generate clips and export a finished video.</p>
          <span className="ws-card-cta">Start <ArrowRight size={15} /></span>
        </Link>
      </div>
    </div>
  );
}
