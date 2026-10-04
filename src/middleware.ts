import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "@/lib/clerk-enabled";

const isPublic = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)", "/sso-callback(.*)"]);

const withClerk = clerkMiddleware((auth, req) => {
  if (!isPublic(req)) auth().protect();
});

// No keys: preview mode, let everything through.
export default clerkEnabled ? withClerk : () => NextResponse.next();

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
