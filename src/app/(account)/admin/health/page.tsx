import { requireAdminPage } from "@/lib/admin-gate";
import HealthReport from "@/components/admin/HealthReport";

export const dynamic = "force-dynamic";

export default async function AdminHealthPage() {
  const admin = await requireAdminPage();
  if (!admin) return <p className="app-muted">This page is not available.</p>;
  return <HealthReport />;
}
