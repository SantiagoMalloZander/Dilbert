import { Badge } from "@/components/ui/badge";
import { requireOwner } from "@/lib/workspace-auth";
import { getUsersCenterData } from "@/lib/workspace-users";
import { UsersCenter } from "@/components/users-center";

export default async function UsersPage() {
  const session = await requireOwner();
  const data = await getUsersCenterData(session.user.companyId);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Badge>Solo Owner</Badge>
        <h2 className="text-3xl font-semibold tracking-tight">Centro de usuarios</h2>
        <p className="text-sm text-muted-foreground">
          Administrá accesos, roles y el link compartible de <strong>{data.companyName}</strong>.
        </p>
      </div>

      <UsersCenter
        companyId={data.companyId}
        vendorLimit={data.vendorLimit}
        activeVendors={data.activeVendors}
        inviteLink={data.inviteLink}
        users={data.users}
      />
    </div>
  );
}
