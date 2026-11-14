import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/admin";
import { adminPasswordSet, hasAdminCookie } from "@/lib/admin-gate";
import AdminLogin from "@/components/admin/AdminLogin";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const admin = await getAdmin();
  if (!admin) return <p className="app-muted">This page is not available.</p>;
  if (!adminPasswordSet() || (await hasAdminCookie())) redirect("/admin");
  return <AdminLogin />;
}
