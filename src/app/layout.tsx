import type { Metadata } from "next";
import { DM_Sans, Inter, Playfair_Display } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkEnabled } from "@/lib/clerk-enabled";
import "./globals.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const display = Inter({ subsets: ["latin"], variable: "--font-display" });
const serif = Playfair_Display({ subsets: ["latin"], style: "italic", variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Eclipse — your creative studio",
  description: "Turn any idea into premium images. By Cosmos Labs AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const page = (
    <html lang="en" className={`${sans.variable} ${display.variable} ${serif.variable}`}>
      <body className="min-h-screen bg-black font-[family-name:var(--font-sans)] text-neutral-100 antialiased">
        {children}
      </body>
    </html>
  );
  return clerkEnabled ? <ClerkProvider>{page}</ClerkProvider> : page;
}
