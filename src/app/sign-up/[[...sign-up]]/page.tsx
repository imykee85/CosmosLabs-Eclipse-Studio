import type { Metadata } from "next";
import AuthShell from "@/components/AuthShell";
import AuthForm from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Sign up", description: "Create your Eclipse Studio account and start making images, video and audio.", robots: { index: false } };

export default function Page() {
  return (
    <AuthShell>
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
