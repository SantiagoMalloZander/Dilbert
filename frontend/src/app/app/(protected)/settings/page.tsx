import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/lib/workspace-auth";
import { listProviders } from "@/modules/insurance/providers/queries";
import { ProvidersManager } from "@/components/settings/ProvidersManager";

export default async function SettingsPage() {
  const session = await requireSession();

  // Tenant configuration is owner-only.
  if (session.user.role !== "owner" && !session.user.isSuperAdmin) {
    redirect("/app/crm");
  }

  const providers = await listProviders();

  return (
    <div className="space-y-6">
      <Card className="bg-card/90">
        <CardContent className="pt-7">
          <div className="space-y-2">
            <Badge className="border border-primary/20 bg-primary/10 text-foreground">
              <Settings className="mr-1.5 h-3.5 w-3.5" />
              Configuración
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Configuración de la empresa</h1>
            <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
              Definí las aseguradoras con las que opera tu agencia y los ramos que cubre cada una. El
              agente las usa para clasificar pólizas y cotizaciones.
            </p>
          </div>
        </CardContent>
      </Card>

      <ProvidersManager initialProviders={providers} />
    </div>
  );
}
