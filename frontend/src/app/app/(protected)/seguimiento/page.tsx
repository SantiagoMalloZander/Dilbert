import { redirect } from "next/navigation";
import { requireSession } from "@/lib/workspace-auth";
import { canViewAllLeads } from "@/lib/auth/permissions";
import { ErrorState } from "@/components/error-state";
import { getFriendlyWorkspaceErrorMessage } from "@/lib/workspace-session-security";
import { getFollowUpData } from "@/modules/seguimiento/queries";
import { FollowUpInbox } from "@/components/follow-up-inbox";

export default async function SeguimientoPage() {
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
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Seguimiento</h1>
        <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
          {canViewAll
            ? "Clientes que esperan respuesta y los que ya están al día. Se actualiza solo a medida que el agente lee las conversaciones."
            : "Tus clientes que esperan respuesta y los que ya están al día. Se actualiza solo a medida que el agente lee tus conversaciones."}
        </p>
      </div>

      <FollowUpInbox initial={data} />
    </div>
  );
}
