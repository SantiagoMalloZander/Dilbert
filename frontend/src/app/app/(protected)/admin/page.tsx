import { requireSuperAdmin } from "@/lib/workspace-auth";
import { listAdminCompanies } from "@/lib/workspace-admin";
import { AdminPanel } from "@/components/admin-panel";

export default async function AdminPage() {
  await requireSuperAdmin();
  const companies = await listAdminCompanies();

  return <AdminPanel companies={companies} />;
}
