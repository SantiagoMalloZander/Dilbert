import { redirect } from "next/navigation";
import { requireSession } from "@/lib/workspace-auth";
import { canViewAllLeads } from "@/lib/auth/permissions";
import { ErrorState } from "@/components/error-state";
import { getFriendlyWorkspaceErrorMessage } from "@/lib/workspace-session-security";
import { getFollowUpData } from "@/modules/seguimiento/queries";
import { FollowUpInbox } from "@/components/follow-up-inbox";

export default async function CrmSeguimientoPage() {
  const session = await requireSession();
  if (!session.user.companyId) redirect("/app/account");

  const canViewAll = canViewAllLeads(session.user.role);

  let data: Awaited<ReturnType<typeof getFollowUpData>>;
  try {
    data = await getFollowUpData({
      companyId: session.user.companyId,
      userId: session.user.id,
      canViewAll,
    });
  } catch (error) {
    return (
      <ErrorState
        title="No pudimos cargar el Seguimiento"
        message={getFriendlyWorkspaceErrorMessage(error)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Seguimiento</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {canViewAll
            ? "Clientes que esperan respuesta y los que ya están al día. Se actualiza solo."
            : "Tus clientes que esperan respuesta y los que ya están al día. Se actualiza solo."}
        </p>
      </div>

      <FollowUpInbox initial={data} />
    </div>
  );
}
