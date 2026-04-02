import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/workspace-auth";

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
  const session = await requireSession();

  if (session.user.role === "analyst") {
    redirect("/app/crm");
  }

  const isOwner = session.user.role === "owner";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Badge>{isOwner ? "Solo lectura" : "Editable"}</Badge>
        <h2 className="text-3xl font-semibold tracking-tight">Centro de integraciones</h2>
        <p className="text-sm text-muted-foreground">
          {isOwner
            ? "Ves el estado de las integraciones conectadas por tu equipo, pero no podés modificarlas desde este rol."
            : "Desde aca vas a conectar tus canales y revisar el estado operativo de cada integracion."}
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
              {isOwner
                ? "Vista de seguimiento para owner. Aca vas a ver que conecto cada vendedor y el estado de salud de cada canal."
                : "Placeholder listo para sumar secretos, permisos y estado de salud por canal."}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
