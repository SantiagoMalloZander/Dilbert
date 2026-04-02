import { BarChart3, Clock3, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const cards = [
  {
    title: "Pipeline privado",
    description:
      "Este panel queda protegido por middleware y por chequeo server-side antes de renderizar.",
    icon: ShieldCheck,
  },
  {
    title: "Sesión activa",
    description:
      "La app fuerza cierre automático después de 30 minutos sin interacción del usuario.",
    icon: Clock3,
  },
  {
    title: "Base lista para crecer",
    description:
      "Quedan conectadas las capas para sumar CRM, bookings, métricas y automatizaciones.",
    icon: BarChart3,
  },
];

export default function CrmPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Badge>Ruta protegida</Badge>
        <h2 className="text-3xl font-semibold tracking-tight">Panel principal</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Esta es la home privada de la app bajo <code>/app/crm</code>. Desde acá
          podés extender el workspace con pipelines, conversaciones, reporting y acciones
          automáticas.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {cards.map(({ title, description, icon: Icon }) => (
          <Card key={title} className="bg-card/90">
            <CardHeader>
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="bg-card/90">
        <CardHeader>
          <CardTitle>Siguiente paso recomendado</CardTitle>
          <CardDescription>
            Conectar Supabase con la tabla <code>users</code> y empezar a colgar
            módulos reales de CRM sobre esta shell.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          La estructura ya separa lo público de lo privado, define el acceso por rol y deja
          lista la autenticación OAuth. Eso evita refactorizar la base cuando entren features
          reales.
        </CardContent>
      </Card>
    </div>
  );
}
