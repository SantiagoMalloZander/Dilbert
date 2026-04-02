import { requireVendor } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const integrations = [
  {
    name: "Supabase",
    detail: "Base de datos, perfiles y estado del workspace.",
  },
  {
    name: "Resend",
    detail: "Emails transaccionales para onboarding, booking y alertas.",
  },
  {
    name: "OAuth",
    detail: "Ingreso con Google y Microsoft mediante NextAuth.",
  },
];

export default async function IntegrationsPage() {
  await requireVendor();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Badge>Solo Vendedor</Badge>
        <h2 className="text-3xl font-semibold tracking-tight">Centro de integraciones</h2>
        <p className="text-sm text-muted-foreground">
          Ruta protegida para operadores comerciales. Los owners quedan afuera por regla.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {integrations.map((integration) => (
          <Card key={integration.name} className="bg-card/90">
            <CardHeader>
              <CardTitle className="text-xl">{integration.name}</CardTitle>
              <CardDescription>{integration.detail}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Placeholder listo para conectar settings reales, secretos y estado de salud.
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
