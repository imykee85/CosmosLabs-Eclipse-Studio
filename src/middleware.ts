import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";

// The payment webhook and the scheduled jobs are called by services with no sign-in; each authenticates itself (signature, CRON_SECRET). Terms and privacy are public pages.
const isPublic = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)", "/sso-callback(.*)", "/api/payments/webhook", "/api/cron/(.*)", "/terms", "/privacy"]);

const withClerk = clerkMiddleware((auth, req) => {
  if (!isPublic(req)) auth().protect();
});

// No keys: preview mode, let everything through.
export default clerkEnabled ? withClerk : () => NextResponse.next();

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)", "/__clerk/:path*"],
};
