// The Connect icon: a satellite with two solar-panel wings and a dish, drawn from a single horizontal layout turned 45 degrees.
// Outline style with currentColor so it matches the other tab icons in both themes.
export default function ConnectIcon({ size = 20, className, strokeWidth = 1.5, ...rest }: { size?: number; className?: string; strokeWidth?: number } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...rest}>
      <g transform="rotate(45 12 12)">
        {/* body */}
        <rect x="9.2" y="9.2" width="5.6" height="5.6" rx=".8" />
        {/* wings: solar panels split into two cells */}
        <rect x="-.2" y="8.5" width="6.8" height="7" rx=".7" />
        <path d="M3.2 8.5v7" strokeWidth={strokeWidth * .6} />
        <rect x="17.4" y="8.5" width="6.8" height="7" rx=".7" />
        <path d="M20.8 8.5v7" strokeWidth={strokeWidth * .6} />
        {/* arms joining the wings to the body */}
        <path d="M6.6 12h2.6M14.8 12h2.6" />
        {/* dish: a bowl on a short mast */}
        <path d="M12 9.2V6.9" />
        <path d="M8.4 3.1a3.6 3.6 0 0 0 7.2 0" />
      </g>
    </svg>
  );
}
