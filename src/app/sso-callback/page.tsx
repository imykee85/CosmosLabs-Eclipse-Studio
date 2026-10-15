import { redirect } from "next/navigation";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { clerkEnabled } from "@/lib/clerk-enabled";

export const dynamic = "force-dynamic";

export default function SsoCallback() {
  if (!clerkEnabled) redirect("/sign-in");
  return <AuthenticateWithRedirectCallback />;
}
