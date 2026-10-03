import { SignUp } from "@clerk/nextjs";
import { clerkEnabled } from "@/lib/clerk-enabled";
import AuthShell from "@/components/AuthShell";

export default function Page() {
  return (
    <AuthShell>
      {!clerkEnabled ? (
        <div className="login-card">
          <h1>sign up</h1>
          <p className="login-intro">Preview mode: sign-in is switched on once Clerk keys are added.</p>
        </div>
      ) : (
        <SignUp appearance={{ variables: { colorPrimary: "#b91c1c", borderRadius: "0.75rem" } }} />
      )}
    </AuthShell>
  );
}
