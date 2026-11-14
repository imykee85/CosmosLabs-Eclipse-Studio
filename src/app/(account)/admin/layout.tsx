import { hasAdminCookie } from "@/lib/admin-gate";
import AdminNav from "@/components/admin/AdminNav";
import "@/components/admin/admin.css";

// Draws the admin menu only for a browser that holds a valid admin cookie; every page still checks both locks itself.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const nav = await hasAdminCookie();
  return <div className="ad-shell">{nav && <AdminNav />}{children}</div>;
}
