import { requireAdminPage } from "@/lib/admin-gate";
import AdminCredits from "@/components/settings/AdminCredits";

export const dynamic = "force-dynamic";

export default async function AdminCreditsPage() {
  const admin = await requireAdminPage();
  if (!admin) return <p className="app-muted">This page is not available.</p>;
  return <AdminCredits email={admin.email} />;
}
