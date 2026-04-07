import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/error-state";
import { IntegrationsCenter } from "@/components/integrations-center";
import { requireSession } from "@/lib/workspace-auth";
import { getFriendlyWorkspaceErrorMessage } from "@/lib/workspace-session-security";
import {
  getOwnerIntegrationsData,
  getVendorIntegrationsData,
} from "@/lib/workspace-integrations";

export default async function IntegrationsPage() {
  const session = await requireSession();

  if (session.user.role === "analyst") {
    redirect("/app/crm");
  }

  const isOwner = session.user.role === "owner";
  let ownerData: Awaited<ReturnType<typeof getOwnerIntegrationsData>> | null = null;
  let vendorData: Awaited<ReturnType<typeof getVendorIntegrationsData>> | null = null;

  try {
    ownerData =
      isOwner && session.user.companyId
        ? await getOwnerIntegrationsData(session.user.companyId)
        : null;
    vendorData =
      session.user.role === "vendor" && session.user.companyId
        ? await getVendorIntegrationsData(session.user.id, session.user.companyId)
        : null;
  } catch (error) {
    return (
      <ErrorState
        title="No pudimos cargar tus integraciones"
        message={getFriendlyWorkspaceErrorMessage(error)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Badge>{isOwner ? "Solo lectura" : "Editable"}</Badge>
        <h2 className="font-heading text-4xl text-[#1A1A1A]">CENTRO DE INTEGRACIONES</h2>
        <p className="text-sm text-[#1A1A1A]/60">
          {isOwner
            ? "Ves el estado de los canales conectados por cada vendedor de tu empresa, sin poder modificarlos."
            : "Desde acá podés conectar y desconectar tus canales. Las nuevas conexiones quedan en pendiente hasta validar credenciales."}
        </p>
      </div>

      <IntegrationsCenter
        role={isOwner ? "owner" : "vendor"}
        ownerVendors={ownerData?.vendors}
        vendorChannels={vendorData?.channels}
      />
    </div>
  );
}
