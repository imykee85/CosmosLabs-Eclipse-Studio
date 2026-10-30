"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SignedIn, SignedOut } from "@/components/auth";

// The About page's button: sign-up for visitors, the studio for people who are signed in.
export default function AboutCta({ children = "Start Creating" }: { children?: React.ReactNode }) {
  return (
    <>
      <SignedOut>
        <Link className="ab-btn" href="/sign-up">{children}<ArrowRight size={15} strokeWidth={1.7} /></Link>
      </SignedOut>
      <SignedIn>
        <Link className="ab-btn" href="/create">Open Studio<ArrowRight size={15} strokeWidth={1.7} /></Link>
      </SignedIn>
    </>
  );
}
