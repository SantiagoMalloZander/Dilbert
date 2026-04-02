import { requireOwner } from "@/lib/workspace-auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function UsersPage() {
  const session = await requireOwner();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Badge>Solo Owner</Badge>
        <h2 className="text-3xl font-semibold tracking-tight">Centro de usuarios</h2>
        <p className="text-sm text-muted-foreground">
          Este módulo queda reservado para el rol <strong>{session.user.role}</strong>.
        </p>
      </div>

      <Card className="bg-card/90">
        <CardHeader>
          <CardTitle>Qué conviene colgar acá</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>1. Alta y baja de usuarios internos.</p>
          <p>2. Asignación de roles y permisos por workspace.</p>
          <p>3. Auditoría de ingresos y cambios sensibles.</p>
        </CardContent>
      </Card>
    </div>
  );
}
