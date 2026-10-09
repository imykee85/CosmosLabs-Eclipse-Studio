// The Connect icon: the Cosmos Labs mark simplified for small sizes. A solid hub with five nodes around it, one for each
// place Connect sends content to (the "C" of the full logo is left out because it blurs below about 24 px).
// One colour (currentColor), so it follows the theme like the other icons.
export default function ConnectMark({ size = 20, className, ...rest }: { size?: number; className?: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true" {...rest}>
      <path d="M12 12V3.4M12 12l8.2-2.7M12 12l5 6.9M12 12l-5 6.9M12 12 3.8 9.3" stroke="currentColor" strokeOpacity=".6" strokeWidth="1.5" strokeLinecap="round" />
      <g fill="currentColor">
        <circle cx="12" cy="12" r="3.2" />
        <circle cx="12" cy="3.4" r="1.8" />
        <circle cx="20.2" cy="9.3" r="1.8" />
        <circle cx="17" cy="18.9" r="1.8" />
        <circle cx="7" cy="18.9" r="1.8" />
        <circle cx="3.8" cy="9.3" r="1.8" />
      </g>
    </svg>
  );
}
