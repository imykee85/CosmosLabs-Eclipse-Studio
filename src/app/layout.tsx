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


// Safari's Page Zoom changes the layout width of a phone page (100% = 390 CSS px, 75% = 520, 50% = 780). The app should never look bigger than it does at 75%:
// above 75% the whole page is scaled down by CSS zoom (0.75 / zoom) so it keeps the 75% layout and size; at 75% and below it is left alone (it shrinks and fills the screen as before).
// The real zoom is read as screen width / layout width. Pinch zoom is untouched.
const ZOOM_CLAMP_SCRIPT = `(function(){try{var de=document.documentElement;function apply(){if(Math.min(screen.width,screen.height)>600||!matchMedia('(orientation: portrait)').matches){de.style.zoom='';return}de.style.zoom='';var z=Math.min(screen.width,screen.height)/innerWidth;var f=z>0.75?0.75/z:1;if(Math.abs(f-1)>0.005)de.style.zoom=String(f)}apply();document.addEventListener('DOMContentLoaded',apply);addEventListener('orientationchange',apply);var w=innerWidth;addEventListener('resize',function(){if(Math.abs(innerWidth-w)>2){w=innerWidth;apply()}})}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const page = (
    <html lang="en" className={`${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ZOOM_CLAMP_SCRIPT }} />
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
