import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/lib/workspace-auth";
import { listZones } from "@/modules/agency/zones/queries";
import { ZonesManager } from "@/components/settings/ZonesManager";

export default async function SettingsPage() {
  const session = await requireSession();

  // Tenant configuration is owner-only.
  if (session.user.role !== "owner" && !session.user.isSuperAdmin) {
    redirect("/app/crm");
  }

  const zones = await listZones();

  return (
    <div className="space-y-6">
      <Card className="bg-card/90">
        <CardContent className="pt-7">
          <div className="space-y-2">
            <Badge className="border border-primary/20 bg-primary/10 text-foreground">
              <Settings className="mr-1.5 h-3.5 w-3.5" />
              Configuración
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Configuración de la agencia</h1>
            <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
              Definí las zonas en las que opera tu inmobiliaria. El agente las usa para clasificar
              búsquedas y marcar como sospechosas las consultas por zonas que no cubrís.
            </p>
          </div>
        </CardContent>
      </Card>

      <ZonesManager initialZones={zones} />
    </div>
  );
}
