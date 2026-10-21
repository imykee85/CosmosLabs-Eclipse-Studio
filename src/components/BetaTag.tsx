// The small "Beta" pill for features that work but are still being polished. Same look as the "Soon" pill.
export default function BetaTag({ className = "" }: { className?: string }) {
  return <span className={`soon-tag ${className}`}>Beta</span>;
}
