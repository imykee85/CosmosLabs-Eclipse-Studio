import type { SVGProps } from "react";

// One coin, drawn like the other line icons: the credit symbol everywhere credits or prices are shown.
export default function CoinIcon({ size = 16, strokeWidth = 2, ...rest }: { size?: number; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, "width" | "height">) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="12" r="6" />
    </svg>
  );
}
