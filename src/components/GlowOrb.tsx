// The red glowing orb. One drawing, used by the Memory page (as `.mm-orb`) and the landing "Atlas, at the core" section, so the two never drift.
export default function GlowOrb({ className = "" }: { className?: string }) {
  return <span className={`glow-orb ${className}`.trim()} aria-hidden="true" />;
}
