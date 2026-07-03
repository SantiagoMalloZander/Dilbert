import { AppNav } from "@/components/app-nav";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { LogoutButton } from "@/components/logout-button";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { WorkspaceSession } from "@/lib/workspace-auth";
import { getRoleLabel } from "@/lib/workspace-roles";

function getInitials(name?: string | null, email?: string | null) {
  const source = name || email || "Dilvert User";
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
    (session.user.isSuperAdmin ? "Dilvert Admin" : "Sin empresa");

  return (
    <div className="min-h-screen bg-background">
      {/* ── Mobile header (compact, sticky) ─────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md lg:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.png" alt="" className="h-6 w-6 shrink-0" />
            <span className="text-lg font-extrabold leading-none tracking-tight text-foreground">
              Dilvert
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <span className="max-w-[45vw] truncate text-xs text-muted-foreground">
              {displayCompanyName}
            </span>
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#1A7A6E]" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 lg:py-5">
        {session.user.impersonation ? (
          <ImpersonationBanner companyName={session.user.impersonation.companyName} />
        ) : null}

        <div className="flex gap-5">
          {/* ── Sidebar (desktop only) ─────────────────────────── */}
          <aside className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-5 flex min-h-[calc(100vh-2.5rem)] flex-col gap-6 rounded-xl border border-border bg-card p-5 shadow-panel">
              {/* Brand */}
              <div>
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icon.png" alt="" className="h-6 w-6 shrink-0" />
                  <span className="text-xl font-extrabold leading-none tracking-tight text-foreground">
                    Dilvert
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 pl-[1.15rem]">
                  <span className="truncate text-[11px] text-muted-foreground">
                    {displayCompanyName}
                  </span>
                  <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#1A7A6E]" />
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
              <div className="mt-auto space-y-3 border-t border-border pt-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8 shrink-0 border border-border">
                    {session.user.image ? (
                      <AvatarImage
                        src={session.user.image}
                        alt={session.user.name || session.user.email || "Usuario"}
                      />
                    ) : null}
                    <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                      {getInitials(session.user.name, session.user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight text-foreground">
                      {session.user.name || "Usuario"}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {getRoleLabel(session.user.role)}
                    </p>
                  </div>
                </div>
                <LogoutButton />
              </div>
            </div>
          </aside>

          {/* ── Main ───────────────────────────────────────────── */}
          <div className="min-w-0 flex-1 pb-24 lg:pb-0">
            <main>{children}</main>
          </div>
        </div>
      </div>

      {/* ── Mobile bottom tab bar ────────────────────────────── */}
      <MobileTabBar
        role={session.user.role}
        email={session.user.email}
        isSuperAdmin={session.user.isSuperAdmin}
        hasWorkspaceAccess={hasWorkspaceAccess}
      />
    </div>
  );
}
