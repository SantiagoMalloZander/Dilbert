import { requireSuperAdmin } from "@/lib/workspace-auth";
import { ErrorState } from "@/components/error-state";
import { getFriendlyWorkspaceErrorMessage } from "@/lib/workspace-session-security";
import { listAdminCompanies } from "@/lib/workspace-admin";
import { AdminPanel } from "@/components/admin-panel";

export default async function AdminPage() {
  await requireSuperAdmin();
  let companies: Awaited<ReturnType<typeof listAdminCompanies>>;

  try {
    companies = await listAdminCompanies();
  } catch (error) {
    return (
      <ErrorState
        title="No pudimos cargar el panel de administración"
        message={getFriendlyWorkspaceErrorMessage(error)}
      />
    );
  }

  return <AdminPanel companies={companies} />;
}
