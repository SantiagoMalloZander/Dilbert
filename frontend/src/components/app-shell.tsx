import { Building2, Sparkles } from "lucide-react";
import type { Session } from "next-auth";
import { AppNav } from "@/components/app-nav";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { LogoutButton } from "@/components/logout-button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { getRoleLabel } from "@/lib/workspace-roles";

function getInitials(name?: string | null, email?: string | null) {
  const source = name || email || "Dilbert User";
  return source
    .split(" ")
    .map((segment) => segment[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AppShell({
  session,
  companyName,
  children,
}: {
  session: Session;
  companyName?: string | null;
  children: React.ReactNode;
}) {
  const hasWorkspaceAccess = Boolean(session.user.companyId);
  const displayCompanyName =
    session.user.impersonation?.companyName ||
    companyName ||
    (session.user.isSuperAdmin ? "Dilbert Admin" : "Sin empresa asignada");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4 md:px-6">
        {session.user.impersonation ? <ImpersonationBanner companyName={session.user.impersonation.companyName} /> : null}

        <div className="flex min-h-[calc(100vh-2rem)] flex-col gap-4 lg:flex-row">
          <aside className="w-full lg:w-72">
            <div className="sticky top-4 rounded-[30px] border border-white/10 bg-card/80 p-5 shadow-panel backdrop-blur">
              <div className="mb-8 space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Dilbert
                </div>

                <div className="rounded-3xl border border-white/10 bg-background/60 p-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Empresa
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{displayCompanyName}</p>
                      <p className="text-xs text-muted-foreground">
                        {hasWorkspaceAccess
                          ? "Workspace activo"
                          : session.user.isSuperAdmin
                            ? "Super Admin"
                            : "Acceso pendiente"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <AppNav
                role={session.user.role}
                isSuperAdmin={session.user.isSuperAdmin}
                hasWorkspaceAccess={hasWorkspaceAccess}
              />
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <header className="rounded-[30px] border border-white/10 bg-card/80 p-5 shadow-panel backdrop-blur">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Workspace protegido
                  </p>
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight">{displayCompanyName}</h1>
                    <p className="text-sm text-muted-foreground">
                      {session.user.impersonation
                        ? `Estás operando como owner sobre ${session.user.impersonation.companyName}.`
                        : hasWorkspaceAccess
                          ? "El contenido cambia segun tu rol dentro de Dilbert."
                          : "Tu acceso todavía no tiene una empresa asignada."}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-background/70 px-3 py-2">
                    <Avatar className="h-10 w-10 border border-white/10">
                      {session.user.image ? (
                        <AvatarImage
                          src={session.user.image}
                          alt={session.user.name || session.user.email || "Usuario"}
                        />
                      ) : null}
                      <AvatarFallback>{getInitials(session.user.name, session.user.email)}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {session.user.name || "Usuario"}
                      </p>
                      <p className="text-xs text-muted-foreground">{session.user.email}</p>
                    </div>
                    <Badge variant="secondary">{getRoleLabel(session.user.role)}</Badge>
                    {session.user.isSuperAdmin ? <Badge>Super Admin</Badge> : null}
                    {session.user.impersonation ? <Badge variant="secondary">Modo Owner</Badge> : null}
                  </div>
                  <LogoutButton />
                </div>
              </div>
              <Separator className="mt-4" />
            </header>

            <main className="py-6">{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
