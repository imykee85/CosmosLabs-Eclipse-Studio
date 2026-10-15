import { getAdmin } from "@/lib/admin";
import AdminCredits from "@/components/settings/AdminCredits";

export const dynamic = "force-dynamic";

export default async function AdminCreditsPage() {
  const admin = await getAdmin();
  if (!admin) return <p className="app-muted">This page is not available.</p>;
  return <AdminCredits email={admin.email} />;
}
