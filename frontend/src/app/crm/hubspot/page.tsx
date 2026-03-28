import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HubSpotCredentialsForm } from "@/components/hubspot-credentials-form";

const SCOPES = [
  { name: "crm.objects.contacts.read", description: "Leer contactos" },
  { name: "crm.objects.contacts.write", description: "Crear y editar contactos" },
  { name: "crm.objects.deals.read", description: "Leer deals" },
  { name: "crm.objects.deals.write", description: "Crear y editar deals" },
  { name: "crm.objects.companies.read", description: "Leer empresas" },
];

export default function HubSpotPage() {
  const isConfigured = !!process.env.HUBSPOT_API_KEY;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">🟠</span>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">HubSpot CRM</h2>
            {isConfigured ? (
              <Badge className="bg-green-500 hover:bg-green-500 text-white">Conectado</Badge>
            ) : (
              <Badge variant="outline">Sin configurar</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Sincroniza leads de Dilbert con tus contactos y deals de HubSpot.
          </p>
        </div>
      </div>

      {/* Credentials form */}
      <HubSpotCredentialsForm isConfigured={isConfigured} />

      {/* Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Permisos requeridos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {SCOPES.map((scope) => (
              <div key={scope.name} className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs text-muted-foreground">{scope.name}</span>
                <span className="text-muted-foreground">{scope.description}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Generá el token en{" "}
            <span className="font-medium text-foreground">
              HubSpot → Settings → Integrations → Private Apps
            </span>
          </p>
        </CardContent>
      </Card>

      {/* What syncs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Qué se sincroniza</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex gap-3">
            <span className="text-green-500 font-bold shrink-0">→</span>
            <div>
              <p className="font-medium">Dilbert → HubSpot</p>
              <p className="text-muted-foreground">
                Cada lead procesado por el bot crea o actualiza un Contacto y un Deal en HubSpot
                con el monto estimado, producto y estado.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-muted-foreground font-bold shrink-0">←</span>
            <div>
              <p className="font-medium text-muted-foreground">HubSpot → Dilbert (próximamente)</p>
              <p className="text-muted-foreground">
                Importar contactos existentes de HubSpot como leads en el pipeline.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
