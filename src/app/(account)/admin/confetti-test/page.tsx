import { getAdmin } from "@/lib/admin";
import ConfettiTest from "./ConfettiTest";

export const dynamic = "force-dynamic";

// TEMPORARY owner page (remove after the owner has heard the pops on a real phone): a button that plays the welcome confetti and its sound from a tap.
export default async function ConfettiTestPage() {
  const admin = await getAdmin();
  if (!admin) return <p className="app-muted">This page is not available.</p>;
  return <ConfettiTest />;
}
