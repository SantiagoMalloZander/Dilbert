import { Sparkles } from "lucide-react";
import type { Session } from "next-auth";
import { AppNav } from "@/components/app-nav";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { LogoutButton } from "@/components/logout-button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const hasWorkspaceAccess = Boolean(session.user.companyId);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 md:px-8">
        {session.user.impersonation ? (
          <ImpersonationBanner companyName={session.user.impersonation.companyName} />
        ) : null}

        <header className="rounded-[28px] border border-white/10 bg-card/80 p-5 shadow-panel backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Dilbert App
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Workspace protegido</h1>
                <p className="text-sm text-muted-foreground">
                  {session.user.impersonation
                    ? `Operando sobre ${session.user.impersonation.companyName} con permisos de owner.`
                    : "Toda la app vive bajo /app y exige sesión activa."}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-background/70 px-3 py-2">
                <Avatar className="h-10 w-10 border border-white/10">
                  <AvatarFallback>{getInitials(session.user.name, session.user.email)}</AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">{session.user.name || "Usuario"}</p>
                  <p className="text-xs text-muted-foreground">{session.user.email}</p>
                </div>
                <Badge variant="secondary">{getRoleLabel(session.user.role)}</Badge>
                {session.user.isSuperAdmin ? <Badge>Super Admin</Badge> : null}
                {session.user.impersonation ? <Badge variant="secondary">Modo Owner</Badge> : null}
              </div>
              <LogoutButton />
            </div>
          </div>
          <Separator className="my-4" />
          <AppNav
            role={session.user.role}
            isSuperAdmin={session.user.isSuperAdmin}
            hasWorkspaceAccess={hasWorkspaceAccess}
          />
        </header>

        <main className="flex-1 py-8">{children}</main>
      </div>
    </div>
  );
}
