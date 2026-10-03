import { SignIn } from "@clerk/nextjs";
import { clerkEnabled } from "@/lib/clerk-enabled";
import { clerkAppearance } from "@/lib/clerk-appearance";
import AuthShell from "@/components/AuthShell";

export default function Page() {
  return (
    <AuthShell>
      {!clerkEnabled ? (
        <div className="login-card">
          <h1>sign in</h1>
          <p className="login-intro">Preview mode: sign-in is switched on once Clerk keys are added.</p>
        </div>
      ) : (
        <SignIn appearance={clerkAppearance} />
      )}
    </AuthShell>
  );
}
