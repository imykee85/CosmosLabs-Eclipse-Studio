// The Agents icon: a solid ball with two glints. Drawn with currentColor, glints cut out so it works on dark and light.
export default function AgentIcon({ size = 20, className, strokeWidth: _strokeWidth, ...rest }: { size?: number; className?: string; strokeWidth?: number } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true" {...rest}>
      <defs>
        <mask id="agent-icon-glints" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="#fff" />
          <rect x="12.55" y="5.9" width="1.7" height="3.9" rx=".85" transform="rotate(-27 13.4 7.85)" fill="#000" />
          <rect x="16.85" y="6.5" width="1.7" height="4.1" rx=".85" transform="rotate(-27 17.7 8.55)" fill="#000" />
        </mask>
      </defs>
      <circle cx="12" cy="12" r="10" mask="url(#agent-icon-glints)" />
    </svg>
  );
}
