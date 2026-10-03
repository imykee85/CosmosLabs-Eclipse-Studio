import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkEnabled } from "@/lib/clerk-enabled";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Eclipse — your creative studio",
  description: "Turn any idea into premium images. By Cosmos Labs AI.",
};

// Desktop layout only: phones and tablets render the 1440px desktop page scaled to fit.
export const viewport: Viewport = { width: 1440 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const page = (
    <html lang="en" className={`${inter.variable}`}>
      <body className="min-h-screen min-w-[1280px] bg-black font-[family-name:var(--font-sans)] text-neutral-100 antialiased">
        {children}
      </body>
    </html>
  );
  return clerkEnabled ? <ClerkProvider>{page}</ClerkProvider> : page;
}
