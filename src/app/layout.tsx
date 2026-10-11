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
  appleWebApp: { capable: true, title: "Eclipse" }, // the status bar style is set by the script below, so it can follow the theme
};

// viewport-fit=cover lets the page reach under the iPhone's status bar when it is translucent (see the script below); env(safe-area-inset-top) keeps headers clear of the clock.
export const viewport = { viewportFit: "cover" } as const;

// iPhone home-screen app: the status bar style is read once when the app opens and cannot follow the light/dark toggle afterwards.
// Light-mode app screens use a translucent bar, so the page's own cream background shows behind the clock; everything else (dark app, landing, login) keeps the solid black bar.
const STATUS_BAR_SCRIPT = `try{var l=localStorage.getItem('eclipse-theme')==='light',s=location.pathname.split('/')[1],a=/^(dashboard|tutorial|agents|assets|canvas|connect|create|gallery|generate|ingredients|library|memory|project|prompts|skills|tools|treatment|admin|avatars|certificates|motion|portfolio|settings)$/.test(s),v=l&&a?'black-translucent':'black',n='apple-mobile-web-app-status-bar-style',f=function(){var q=document.querySelectorAll('meta[name="'+n+'"]');if(!q.length){var m=document.createElement('meta');m.name=n;document.head.appendChild(m);q=[m]}for(var i=0;i<q.length;i++)q[i].content=v};f();document.addEventListener('DOMContentLoaded',f);new MutationObserver(f).observe(document.head,{childList:true});addEventListener('load',f)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const page = (
    <html lang="en" className={`${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: STATUS_BAR_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('eclipse-theme')==='light')document.documentElement.setAttribute('data-app-theme','light')}catch(e){}" }} />
      </head>
      <body className="min-h-screen bg-black font-[family-name:var(--font-sans)] text-neutral-100 antialiased">
        {children}
      </body>
    </html>
  );
  return clerkEnabled ? <ClerkProvider>{page}</ClerkProvider> : page;
}
