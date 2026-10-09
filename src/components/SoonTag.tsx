// The small "Soon" pill for anything that has no working feature behind it yet. Remove the tag where the feature is finished.
export default function SoonTag({ className = "" }: { className?: string }) {
  return <span className={`soon-tag ${className}`}>Soon</span>;
}
