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


// Phones: Safari's Page Zoom (aA menu) changes the layout width of a phone page (100% = 390 CSS px, 75% = 520, 50% = 780).
// The app should never look bigger than it does at 75%. At load the script reads the layout width Safari gave the page; ABOVE 75% (narrower than screen / 0.75) it sets a fixed viewport width of screen / 0.75, so the page keeps the 75% layout and fills the screen.
// At 75% and below Safari's own layout is left alone (the page shrinks and fills the screen, no left shift). The decision is made once per page load. Pinch zoom is untouched. Landscape and tablets are not touched.
const PHONE_LAYOUT_SCRIPT = `(function(){try{var s=Math.min(screen.width,screen.height);if(s>600||!matchMedia('(orientation: portrait)').matches)return;var P=0.75,W=Math.round(s/P),clamp=innerWidth<W-4;function sig(){var v=window.visualViewport;return innerWidth+'/'+(v?Math.round(v.width*v.scale):0)+'/'+devicePixelRatio}var last=sig(),tm=0;function chk(){var n=sig();if(n===last)return;clearTimeout(tm);tm=setTimeout(function(){if(sig()!==n)return;try{var t=+sessionStorage.getItem('eclipse-zr')||0;if(Date.now()-t<3000)return;sessionStorage.setItem('eclipse-zr',String(Date.now()))}catch(e){}last=n;location.reload()},350)}addEventListener('resize',chk);if(window.visualViewport)visualViewport.addEventListener('resize',chk);addEventListener('pageshow',chk);setInterval(chk,800);if(!clamp)return;function run(){var q=document.querySelectorAll('meta[name="viewport"]');if(!q.length){var m=document.createElement('meta');m.name='viewport';m.content='width='+W;document.head.appendChild(m);q=[m]}for(var i=0;i<q.length;i++){var o={},t=q[i].content.split(',');for(var j=0;j<t.length;j++){var kv=t[j].split('=');if(kv[0].trim())o[kv[0].trim()]=(kv[1]||'').trim()}o.width=String(W);delete o['initial-scale'];delete o['maximum-scale'];var out=[];for(var k in o)out.push(k+'='+o[k]);out=out.join(', ');if(q[i].content!==out)q[i].content=out}last=sig()}run();document.addEventListener('DOMContentLoaded',run);addEventListener('load',run);new MutationObserver(run).observe(document.head,{childList:true,subtree:true,attributes:true,attributeFilter:['content']})}catch(e){}})();`;

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
