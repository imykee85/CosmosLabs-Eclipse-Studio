import type { Metadata } from "next";
import AuthShell from "@/components/AuthShell";
import AuthForm from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Log in", description: "Log in to Eclipse Studio to pick up your projects, images, video and audio.", robots: { index: false } };

export default function Page() {
  return (
    <AuthShell>
      <AuthForm mode="signin" />
    </AuthShell>
  );
}
