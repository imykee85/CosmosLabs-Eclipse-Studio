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


// Phones: the page is laid out at a FIXED width of (screen width / 0.75) CSS pixels, the same layout as Safari's 75% page zoom, whatever Page Zoom is set to in Safari's aA menu.
// iPhone Safari's Page Zoom changes the layout width (50% gives a desktop-width page), which broke the phone layout; a fixed viewport width makes the page fit the screen instead.
// People zoom by pinching. Landscape and tablets keep width=device-width.
const PHONE_LAYOUT_SCRIPT = `(function(){try{var P=0.75;function run(){var s=Math.min(screen.width,screen.height);if(s>600)return;var port=matchMedia('(orientation: portrait)').matches;var q=document.querySelectorAll('meta[name="viewport"]');if(!q.length){var m=document.createElement('meta');m.name='viewport';m.content='width=device-width';document.head.appendChild(m);q=[m]}for(var i=0;i<q.length;i++){var o={},t=q[i].content.split(',');for(var j=0;j<t.length;j++){var kv=t[j].split('=');if(kv[0].trim())o[kv[0].trim()]=(kv[1]||'').trim()}o.width=port?String(Math.round(s/P)):'device-width';if(port)delete o['initial-scale'];else o['initial-scale']='1';var out=[];for(var k in o)out.push(k+'='+o[k]);out=out.join(', ');if(q[i].content!==out)q[i].content=out}}run();document.addEventListener('DOMContentLoaded',run);addEventListener('load',run);addEventListener('orientationchange',run);addEventListener('resize',run);new MutationObserver(run).observe(document.head,{childList:true,subtree:true,attributes:true,attributeFilter:['content']})}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const page = (
    <html lang="en" className={`${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PHONE_LAYOUT_SCRIPT }} />
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
