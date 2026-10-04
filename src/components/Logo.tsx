import Link from "next/link";

// Cosmos Labs mark: red hub with the C, white nodes around it.
export function LogoMark({ size = 52 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="140 140 1664 1664" role="img" aria-label="Eclipse by Cosmos Labs" color="#fff">
      <line x1="972" y1="952" x2="1088" y2="293" stroke="currentColor" strokeOpacity=".45" strokeWidth="14" strokeDasharray="40 26"/><line x1="972" y1="952" x2="1485" y2="522" stroke="currentColor" strokeOpacity=".45" strokeWidth="14" strokeDasharray="40 26"/><line x1="972" y1="952" x2="1641" y2="952" stroke="currentColor" strokeOpacity=".45" strokeWidth="14" strokeDasharray="40 26"/><line x1="972" y1="952" x2="1485" y2="1383" stroke="currentColor" strokeOpacity=".45" strokeWidth="14" strokeDasharray="40 26"/><line x1="972" y1="952" x2="1088" y2="1612" stroke="currentColor" strokeOpacity=".45" strokeWidth="14" strokeDasharray="40 26"/><line x1="972" y1="952" x2="637" y2="1531" stroke="currentColor" strokeOpacity=".45" strokeWidth="14" strokeDasharray="40 26"/><line x1="972" y1="952" x2="342" y2="1182" stroke="currentColor" strokeOpacity=".45" strokeWidth="14" strokeDasharray="40 26"/><line x1="972" y1="952" x2="342" y2="723" stroke="currentColor" strokeOpacity=".45" strokeWidth="14" strokeDasharray="40 26"/><line x1="972" y1="952" x2="637" y2="372" stroke="currentColor" strokeOpacity=".45" strokeWidth="14" strokeDasharray="40 26"/><circle cx="1088" cy="293" r="62" fill="currentColor"/><circle cx="1485" cy="522" r="62" fill="currentColor"/><circle cx="1641" cy="952" r="62" fill="currentColor"/><circle cx="1485" cy="1383" r="62" fill="currentColor"/><circle cx="1088" cy="1612" r="62" fill="currentColor"/><circle cx="637" cy="1531" r="62" fill="currentColor"/><circle cx="342" cy="1182" r="62" fill="currentColor"/><circle cx="342" cy="723" r="62" fill="currentColor"/><circle cx="637" cy="372" r="62" fill="currentColor"/><circle cx="972" cy="952" r="193" fill="#ff0101"/><path d="M1049 890H922Q909 890 909 903V1000Q909 1014 922 1014H1049" fill="none" stroke="#fff" strokeWidth="32" strokeLinejoin="round"/>
    </svg>
  );
}

export default function Logo({ size = 52, className = "" }: { size?: number; className?: string }) {
  return (
    <Link href="/" className={className} aria-label="Eclipse home">
      <LogoMark size={size} />
    </Link>
  );
}
