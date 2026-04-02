import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { IntegrationsCenter } from "@/components/integrations-center";
import { requireSession } from "@/lib/workspace-auth";
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
  const ownerData =
    isOwner && session.user.companyId
      ? await getOwnerIntegrationsData(session.user.companyId)
      : null;
  const vendorData =
    session.user.role === "vendor"
      ? await getVendorIntegrationsData(session.user.id)
      : null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Badge>{isOwner ? "Solo lectura" : "Editable"}</Badge>
        <h2 className="text-3xl font-semibold tracking-tight">Centro de integraciones</h2>
        <p className="text-sm text-muted-foreground">
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
