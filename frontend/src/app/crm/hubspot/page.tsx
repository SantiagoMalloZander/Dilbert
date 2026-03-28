import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b bg-card/60">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Integración CRM
        </p>
        <div className="flex items-center gap-3 mt-1">
          <div className="h-9 w-9 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
            <Image
              src="/CRMs/Hudspot.png"
              alt="HubSpot"
              width={36}
              height={36}
              className="object-contain"
            />
          </div>
          <h1 className="font-heading text-4xl tracking-wide leading-none">HUBSPOT</h1>
          {isConfigured ? (
            <span className="text-[10px] font-mono border border-[#1A7A6E]/40 rounded px-2 py-0.5 text-[#1A7A6E] uppercase tracking-wider bg-[#1A7A6E]/8">
              Conectado
            </span>
          ) : (
            <span className="text-[10px] font-mono border border-border rounded px-2 py-0.5 text-muted-foreground uppercase tracking-wider">
              Sin configurar
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1.5">
          Sincroniza leads de Dilbert con tus contactos y deals de HubSpot.
        </p>
      </div>

      <div className="p-6 space-y-4 max-w-3xl">
        <HubSpotCredentialsForm isConfigured={isConfigured} />

        <Card>
          <CardHeader className="pb-3">
            <p className="text-[9px] font-mono font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Accesos
            </p>
            <CardTitle className="font-heading text-xl tracking-wide leading-none mt-0.5">
              PERMISOS REQUERIDOS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {SCOPES.map((scope) => (
              <div
                key={scope.name}
                className="flex items-center justify-between text-sm border-b border-border/40 pb-2 last:border-0 last:pb-0"
              >
                <span className="font-mono text-[10px] text-muted-foreground">{scope.name}</span>
                <span className="text-xs text-muted-foreground">{scope.description}</span>
              </div>
            ))}
            <p className="pt-2 text-[10px] font-mono text-muted-foreground/60">
              Generá el token en HubSpot → Settings → Integrations → Private Apps
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <p className="text-[9px] font-mono font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Flujo de datos
            </p>
            <CardTitle className="font-heading text-xl tracking-wide leading-none mt-0.5">
              QUÉ SE SINCRONIZA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex gap-3 items-start">
              <span className="font-mono text-[#D4420A] font-bold shrink-0 mt-0.5">→</span>
              <div>
                <p className="font-medium">Dilbert → HubSpot</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Cada lead procesado por el bot crea o actualiza un Contacto y un Deal
                  con el monto estimado, producto y estado.
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start opacity-50">
              <span className="font-mono font-bold shrink-0 mt-0.5">←</span>
              <div>
                <p className="font-medium">HubSpot → Dilbert (próximamente)</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Importar contactos existentes de HubSpot como leads en el pipeline.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
