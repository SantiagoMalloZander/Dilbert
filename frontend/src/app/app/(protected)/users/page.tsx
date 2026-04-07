import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/error-state";
import { requireOwner } from "@/lib/workspace-auth";
import { getFriendlyWorkspaceErrorMessage } from "@/lib/workspace-session-security";
import { getUsersCenterData } from "@/modules/users/queries";
import { UsersCenter } from "@/components/users-center";

export default async function UsersPage() {
  const session = await requireOwner();
  let data: Awaited<ReturnType<typeof getUsersCenterData>>;

  try {
    data = await getUsersCenterData(session.user.companyId);
  } catch (error) {
    return (
      <ErrorState
        title="No pudimos cargar el Centro de Usuarios"
        message={getFriendlyWorkspaceErrorMessage(error)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Badge>Solo Owner</Badge>
        <h2 className="font-heading text-4xl text-[#1A1A1A]">CENTRO DE USUARIOS</h2>
        <p className="text-sm text-[#1A1A1A]/60">
          Administrá accesos, roles y el link compartible de <strong>{data.companyName}</strong>.
        </p>
      </div>

      <UsersCenter
        vendorLimit={data.vendorLimit}
        activeVendors={data.activeVendors}
        inviteLink={data.inviteLink}
        users={data.users}
      />
    </div>
  );
}
