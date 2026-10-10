import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkEnabled } from "@/lib/clerk-enabled";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Eclipse — your creative studio",
  description: "Turn any idea into premium images. By Cosmos Labs AI.",
  applicationName: "Eclipse",
  // iPhone "Add to Home Screen": the name under the icon (the icon is src/app/apple-icon.png).
  appleWebApp: { capable: true, title: "Eclipse", statusBarStyle: "black" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const page = (
    <html lang="en" className={`${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('eclipse-theme')==='light')document.documentElement.setAttribute('data-app-theme','light')}catch(e){}" }} />
      </head>
      <body className="min-h-screen bg-black font-[family-name:var(--font-sans)] text-neutral-100 antialiased">
        {children}
      </body>
    </html>
  );
  return clerkEnabled ? <ClerkProvider>{page}</ClerkProvider> : page;
}
