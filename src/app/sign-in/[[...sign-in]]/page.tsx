import { SignIn } from "@clerk/nextjs";
import AuthShell from "@/components/AuthShell";

export default function Page() {
  return (
    <AuthShell>
      <SignIn appearance={{ variables: { colorPrimary: "#6d4fd6", borderRadius: "0.75rem" } }} />
    </AuthShell>
  );
}
