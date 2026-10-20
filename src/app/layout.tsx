import type { Metadata } from "next";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkLocalization } from "@/lib/clerk-localization";
import { Analytics } from "@vercel/analytics/react"; // page views; sends nothing until Web Analytics is switched on in the Vercel project
import { clerkEnabled } from "@/lib/clerk-enabled";
import LocaleProvider from "@/components/i18n/LocaleProvider";
import WorkspaceWatcher from "@/components/WorkspaceWatcher";
import "./globals.css";

// Inter is kept in the repo (src/app/fonts) instead of downloaded from Google at build time: a failed download once broke a Vercel build.
const inter = localFont({ src: "./fonts/Inter-latin.woff2", weight: "100 900", display: "swap", variable: "--font-sans" });

// The address people share and search engines index: NEXT_PUBLIC_SITE_URL (Config value, the real domain once there is one), else Vercel's production address, else local.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
const description = "Eclipse is an AI creative suite by Cosmos Labs AI. Turn any idea into premium images, with video on the way.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Eclipse Studio: your AI creative suite", template: "%s | Eclipse Studio" },
  description,
  applicationName: "Eclipse",
  openGraph: { type: "website", siteName: "Eclipse Studio", title: "Eclipse Studio: your AI creative suite", description }, // the picture comes from opengraph-image.tsx
  twitter: { card: "summary_large_image", title: "Eclipse Studio: your AI creative suite", description },
  // iPhone "Add to Home Screen": the name under the icon (the icon is src/app/apple-icon.png).
  appleWebApp: { capable: true, title: "Eclipse" }, // the status bar style is set by the script below, so it can follow the theme
};

// viewport-fit=cover lets the page reach under the iPhone's status bar when it is translucent (see the script below); env(safe-area-inset-top) keeps headers clear of the clock.
export const viewport = { viewportFit: "cover" } as const;

// iPhone home-screen app: the status bar style is read once when the app opens and cannot follow the light/dark toggle afterwards.
// Light-mode app screens use a translucent bar, so the page's own cream background shows behind the clock; everything else (dark app, landing, login) keeps the solid black bar.
const STATUS_BAR_SCRIPT = `try{var l=localStorage.getItem('eclipse-theme')==='light',s=location.pathname.split('/')[1],a=/^(dashboard|tutorial|agents|assets|canvas|connect|create|gallery|generate|ingredients|library|memory|project|prompts|skills|tools|treatment|admin|avatars|certificates|motion|portfolio|settings)$/.test(s),v=l&&a?'black-translucent':'black',n='apple-mobile-web-app-status-bar-style',f=function(){var q=document.querySelectorAll('meta[name="'+n+'"]');if(!q.length){var m=document.createElement('meta');m.name=n;document.head.appendChild(m);q=[m]}for(var i=0;i<q.length;i++)q[i].content=v};f();document.addEventListener('DOMContentLoaded',f);new MutationObserver(f).observe(document.head,{childList:true});addEventListener('load',f)}catch(e){}`;


// Phones: the layout width is FIXED per page, whatever Safari's Page Zoom (aA menu) says (100% = 390 CSS px, 75% = 520, 50% = 780).
// The landing page (only "/") is laid out at screen / 0.5 (780 px on a 390 phone: the desktop-style 50% view); every other page (login, onboarding, dashboard, studio, account) at screen / 0.75 (520 px: the phone-app layout).
// A fixed viewport width fits the screen at that Page Zoom or higher, so people can zoom in with Page Zoom or pinching without the layout changing. The width follows client-side navigation (history.pushState / popstate), so going from the landing page to login switches 780 to 520 without a reload.
// Portrait phones only (shorter screen side <= 600); landscape and tablets keep width=device-width.
const PHONE_LAYOUT_SCRIPT = `(function(){try{var s=Math.min(screen.width,screen.height);if(s>600)return;function W(){return Math.round(s/(location.pathname==='/'?0.5:0.75))}function run(){var port=matchMedia('(orientation: portrait)').matches;var q=document.querySelectorAll('meta[name="viewport"]');if(!q.length){var m=document.createElement('meta');m.name='viewport';m.content='width=device-width';document.head.appendChild(m);q=[m]}for(var i=0;i<q.length;i++){var o={},t=q[i].content.split(',');for(var j=0;j<t.length;j++){var kv=t[j].split('=');if(kv[0].trim())o[kv[0].trim()]=(kv[1]||'').trim()}if(port){o.width=String(W());delete o['initial-scale'];delete o['maximum-scale']}else{o.width='device-width';o['initial-scale']='1'}document.documentElement.style.setProperty('--in-fs',(port?16*W()/s:16)+'px');var out=[];for(var k in o)out.push(k+'='+o[k]);out=out.join(', ');if(q[i].content!==out)q[i].content=out}}run();function fz(e,ms){var t=e.target;if(!t||!t.closest||!(t=t.closest('input,textarea,select,label')))return;var h=document.documentElement;h.setAttribute('data-fz','1');clearTimeout(window.__fzT);window.__fzT=setTimeout(function(){h.removeAttribute('data-fz')},ms)}var F=HTMLElement.prototype.focus;HTMLElement.prototype.focus=function(){if(/^(INPUT|TEXTAREA|SELECT)$/.test(this.tagName)){var h=document.documentElement;h.setAttribute('data-fz','1');clearTimeout(window.__fzT);window.__fzT=setTimeout(function(){h.removeAttribute('data-fz')},700);void this.offsetWidth}return F.apply(this,arguments)};document.addEventListener('touchstart',function(e){var a=e.target&&e.target.closest&&e.target.closest('input,textarea,select,label');if(a&&a!==document.activeElement)fz(e,600)},{passive:true,capture:true});document.addEventListener('focusin',function(e){fz(e,350)});document.addEventListener('DOMContentLoaded',run);addEventListener('load',run);addEventListener('orientationchange',run);addEventListener('popstate',run);['pushState','replaceState'].forEach(function(n){var f=history[n];history[n]=function(){var r=f.apply(this,arguments);setTimeout(run,0);return r}});new MutationObserver(run).observe(document.head,{childList:true,subtree:true,attributes:true,attributeFilter:['content']})}catch(e){}})();`;

// A visitor whose language is not English: start downloading that language's dictionary right now (before the page's code has even loaded) and hide the page until it is translated, so English never shows.
// The language is the person's own choice (localStorage) or the cookie the middleware set from their connection. A repeat visitor already has the dictionary in this browser. The legal and admin pages are never translated.
// The provider removes the hiding as soon as the page is translated; the timer here is only a safety net.
const LANGUAGE_SCRIPT = `try{var c=null;try{var v=JSON.parse(localStorage.getItem('eclipse-locale')||'null');c=v&&v.lang}catch(e){}var m=document.cookie.match(/(?:^|; )eclipse-lang=([^;]*)/),l=c||(m&&m[1])||'en';if(l!=='en'&&!/^\\/(terms|privacy|admin)(\\/|$)/.test(location.pathname)){var h=document.documentElement;h.setAttribute('data-i18n','pending');window.__i18n=fetch('/api/i18n/'+l).then(function(r){return r.ok?r.json():null}).then(function(j){return j&&j.d&&Object.keys(j.d).length?(function(){try{localStorage.setItem('eclipse-i18n-dict-'+l,JSON.stringify({d:j.d,at:Date.now()}))}catch(e){}return j.d})():null}).catch(function(){return null});setTimeout(function(){h.removeAttribute('data-i18n')},3000)}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const page = (
    <html lang="en" className={`${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PHONE_LAYOUT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: STATUS_BAR_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: LANGUAGE_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('eclipse-theme')==='light')document.documentElement.setAttribute('data-app-theme','light')}catch(e){}" }} />
      </head>
      <body className="min-h-screen bg-black font-[family-name:var(--font-sans)] text-neutral-100 antialiased">
        <LocaleProvider>{children}</LocaleProvider>
        <WorkspaceWatcher />
        <Analytics />
      </body>
    </html>
  );
  return clerkEnabled ? <ClerkProvider localization={clerkLocalization}>{page}</ClerkProvider> : page;
}
