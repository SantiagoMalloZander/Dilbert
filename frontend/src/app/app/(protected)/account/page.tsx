import { getAuthSession, requireSession } from "@/lib/workspace-auth";
import { isSupabaseConfigured } from "@/lib/workspace-supabase";
import { getRoleLabel } from "@/lib/workspace-roles";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AccountPage() {
  const session = await requireSession();
  const liveSession = await getAuthSession();

  const services = [
    { label: "Supabase", ready: isSupabaseConfigured() },
    { label: "Resend", ready: Boolean(process.env.RESEND_API_KEY) },
    {
      label: "Google OAuth",
      ready: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
    {
      label: "Microsoft OAuth",
      ready: Boolean(
        process.env.MICROSOFT_CLIENT_ID &&
          process.env.MICROSOFT_CLIENT_SECRET &&
          process.env.MICROSOFT_TENANT_ID
      ),
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="bg-card/90">
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-2xl border border-white/10 bg-background/60 p-4">
            <p className="text-muted-foreground">Nombre</p>
            <p className="mt-1 font-medium">{session.user.name || "Sin nombre"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-background/60 p-4">
            <p className="text-muted-foreground">Email</p>
            <p className="mt-1 font-medium">{session.user.email}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-background/60 p-4">
            <p className="text-muted-foreground">Rol</p>
            <p className="mt-1 font-medium">{getRoleLabel(session.user.role)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-background/60 p-4">
            <p className="text-muted-foreground">Sesión cargada</p>
            <p className="mt-1 font-medium">{liveSession ? "Activa" : "No disponible"}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/90">
        <CardHeader>
          <CardTitle>Estado de integraciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {services.map((service) => (
            <div
              key={service.label}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-background/60 px-4 py-3"
            >
              <span className="text-sm">{service.label}</span>
              <Badge variant={service.ready ? "default" : "outline"}>
                {service.ready ? "Configurado" : "Pendiente"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
