import { BarChart3, MessageSquareText, PlugZap, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/workspace-auth";
import { getRoleLabel } from "@/lib/workspace-roles";

const cards = [
  {
    title: "Leads este mes",
    description: "Todavia no hay datos cargados.",
    value: "--",
    icon: BarChart3,
  },
  {
    title: "Conversaciones activas",
    description: "Esperando conexiones de canales.",
    value: "--",
    icon: MessageSquareText,
  },
  {
    title: "Canales conectados",
    description: "WhatsApp, Gmail, Instagram y mas.",
    value: "--",
    icon: PlugZap,
  },
  {
    title: "Vendedores activos",
    description: "Usuarios comerciales con acceso vigente.",
    value: "--",
    icon: Users,
  },
];

export default async function CrmPage() {
  const session = await requireSession();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Badge>{getRoleLabel(session.user.role)}</Badge>
        <h2 className="text-3xl font-semibold tracking-tight">
          Bienvenido, {session.user.name || "equipo"}
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          El CRM se ira completando a medida que conectes tus canales.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ title, description, value, icon: Icon }) => (
          <Card key={title} className="bg-card/90">
            <CardHeader>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-3xl font-semibold tracking-tight text-foreground">
                  {value}
                </span>
              </div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="bg-card/90">
        <CardHeader>
          <CardTitle>Workspace listo para crecer</CardTitle>
          <CardDescription>
            Esta home ya separa lo que puede ver cada rol dentro del producto.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          A medida que entren leads, conversaciones y sincronizaciones reales, este panel va a
          mostrar metricas de pipeline, actividad comercial y estado de los canales conectados.
        </CardContent>
      </Card>
    </div>
  );
}
