import { getAdmin } from "@/lib/admin";
import HealthReport from "@/components/admin/HealthReport";

export const dynamic = "force-dynamic";

export default async function AdminHealthPage() {
  const admin = await getAdmin();
  if (!admin) return <p className="app-muted">This page is not available.</p>;
  return <HealthReport />;
}
