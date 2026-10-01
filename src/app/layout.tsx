import type { Metadata } from "next";
import Link from "next/link";
import { ClerkProvider, SignedIn, UserButton } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eclipse",
  description: "AI image generation by Cosmos Labs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
          <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Eclipse
            </Link>
            <SignedIn>
              <nav className="flex items-center gap-4 text-sm">
                <Link href="/" className="text-neutral-300 hover:text-white">Create</Link>
                <Link href="/gallery" className="text-neutral-300 hover:text-white">Gallery</Link>
                <UserButton afterSignOutUrl="/sign-in" />
              </nav>
            </SignedIn>
          </header>
          <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
