import { useId } from "react";

// The Connect icon: the Cosmos Labs mark simplified for small sizes. A hub carrying the "C" with five nodes around it,
// one for each place Connect sends content to. One colour (currentColor); the "C" is cut out of the hub, so it follows
// the theme like the other icons.
export default function ConnectMark({ size = 20, className, ...rest }: { size?: number; className?: string } & React.SVGProps<SVGSVGElement>) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true" {...rest}>
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="#fff" />
          <path d="M13.6 10.7h-2.4a.6.6 0 0 0-.6.6v1.4a.6.6 0 0 0 .6.6h2.4" stroke="#000" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        </mask>
      </defs>
      <path d="M12 12V3.4M12 12l8.2-2.7M12 12l5 6.9M12 12l-5 6.9M12 12 3.8 9.3" stroke="currentColor" strokeOpacity=".6" strokeWidth="1.5" strokeLinecap="round" />
      <g fill="currentColor" mask={`url(#${id})`}>
        <circle cx="12" cy="12" r="3.4" />
      </g>
      <g fill="currentColor">
        <circle cx="12" cy="3.4" r="1.8" />
        <circle cx="20.2" cy="9.3" r="1.8" />
        <circle cx="17" cy="18.9" r="1.8" />
        <circle cx="7" cy="18.9" r="1.8" />
        <circle cx="3.8" cy="9.3" r="1.8" />
      </g>
    </svg>
  );
}
