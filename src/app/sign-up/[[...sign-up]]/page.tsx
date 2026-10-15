import AuthShell from "@/components/AuthShell";
import AuthForm from "@/components/auth/AuthForm";

export default function Page() {
  return (
    <AuthShell>
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
