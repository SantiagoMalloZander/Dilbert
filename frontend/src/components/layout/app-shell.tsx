import { AppNav } from "@/components/app-nav";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { LogoutButton } from "@/components/logout-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { WorkspaceSession } from "@/lib/workspace-auth";
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
  session: WorkspaceSession;
  companyName?: string | null;
  children: React.ReactNode;
}) {
  const hasWorkspaceAccess = Boolean(session.user.companyId);
  const displayCompanyName =
    session.user.impersonation?.companyName ||
    companyName ||
    (session.user.isSuperAdmin ? "Dilbert Admin" : "Sin empresa");

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6">
        {session.user.impersonation ? (
          <ImpersonationBanner companyName={session.user.impersonation.companyName} />
        ) : null}

        <div className="flex min-h-screen gap-5 lg:flex-row flex-col">

        {/* ── Sidebar ────────────────────────────────────────── */}
        <aside className="w-full lg:w-64 shrink-0">
          <div className="sticky top-5 flex flex-col rounded-2xl border border-border bg-card shadow-panel p-5 gap-6">

            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#D4420A] shrink-0" />
                <span className="text-xl font-extrabold tracking-tight text-foreground leading-none">
                  Dilbert
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2 pl-[1.15rem]">
                <span className="text-[11px] text-muted-foreground truncate">
                  {displayCompanyName}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#1A7A6E] animate-pulse shrink-0" />
              </div>
            </div>

            {/* Nav */}
            <AppNav
              role={session.user.role}
              email={session.user.email}
              isSuperAdmin={session.user.isSuperAdmin}
              hasWorkspaceAccess={hasWorkspaceAccess}
            />

            {/* User */}
            <div className="mt-auto pt-4 border-t border-border space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 border border-border shrink-0">
                  {session.user.image ? (
                    <AvatarImage
                      src={session.user.image}
                      alt={session.user.name || session.user.email || "Usuario"}
                    />
                  ) : null}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                    {getInitials(session.user.name, session.user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate leading-tight">
                    {session.user.name || "Usuario"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {getRoleLabel(session.user.role)}
                  </p>
                </div>
              </div>
              <LogoutButton />
            </div>
          </div>
        </aside>

        {/* ── Main ───────────────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          <main>{children}</main>
        </div>

        </div>{/* end flex row */}
      </div>
    </div>
  );
}
