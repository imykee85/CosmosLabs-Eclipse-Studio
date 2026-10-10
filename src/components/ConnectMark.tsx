// The Orbit icon: the Cosmos Labs mark at small size. Same layout as the full logo: a hub with nine nodes in an even ring
// (40 degrees apart, the first at 280 degrees, exactly as in the logo) joined to it by faint lines. The "C" of the full
// logo is left out because it blurs below about 24 px. One colour (currentColor), so it follows the theme.
const NODE_ANGLES = [280, 320, 0, 40, 80, 120, 160, 200, 240];
const R = 9.2;
const nodes = NODE_ANGLES.map((deg) => ({ x: +(12 + R * Math.cos((deg * Math.PI) / 180)).toFixed(2), y: +(12 + R * Math.sin((deg * Math.PI) / 180)).toFixed(2) }));

export default function ConnectMark({ size = 20, className, ...rest }: { size?: number; className?: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true" {...rest}>
      <path d={nodes.map((n) => `M12 12L${n.x} ${n.y}`).join("")} stroke="currentColor" strokeOpacity=".5" strokeWidth="1" strokeLinecap="round" />
      <g fill="currentColor">
        <circle cx="12" cy="12" r="3" />
        {nodes.map((n, i) => <circle key={i} cx={n.x} cy={n.y} r="1.4" />)}
      </g>
    </svg>
  );
}
