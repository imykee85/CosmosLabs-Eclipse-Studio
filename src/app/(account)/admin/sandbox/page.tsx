import { requireAdminPage } from "@/lib/admin-gate";
import AdminSandbox from "@/components/admin/AdminSandbox";

export const dynamic = "force-dynamic";

export default async function AdminSandboxPage() {
  if (!(await requireAdminPage())) return <p className="app-muted">This page is not available.</p>;
  return <AdminSandbox />;
}
