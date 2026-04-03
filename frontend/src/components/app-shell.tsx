import type { Session } from "next-auth";
import { AppNav } from "@/components/app-nav";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { LogoutButton } from "@/components/logout-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
    (session.user.isSuperAdmin ? "Dilbert Admin" : "Sin empresa");

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      <div className="mx-auto flex min-h-screen max-w-7xl gap-5 px-4 py-5 md:px-6 lg:flex-row flex-col">
        {session.user.impersonation ? (
          <ImpersonationBanner companyName={session.user.impersonation.companyName} />
        ) : null}

        {/* ── Sidebar ────────────────────────────────────────── */}
        <aside className="w-full lg:w-64 shrink-0">
          <div className="sticky top-5 flex flex-col rounded-xl border-[3px] border-[#2A1A0A] bg-[#1A1A1A] shadow-[4px_4px_0px_#2A1A0A] p-5 gap-6">

            {/* Brand */}
            <div>
              <div className="font-heading text-2xl text-[#D4420A] leading-none tracking-wide">
                DILBERT.
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#F5F0E8]/35">
                  {displayCompanyName}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#1A7A6E] animate-pulse shrink-0" />
              </div>
            </div>

            {/* Nav */}
            <AppNav
              role={session.user.role}
              isSuperAdmin={session.user.isSuperAdmin}
              hasWorkspaceAccess={hasWorkspaceAccess}
            />

            {/* User */}
            <div className="mt-auto pt-4 border-t border-[#F5F0E8]/10 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 border border-[#F5F0E8]/20 shrink-0">
                  {session.user.image ? (
                    <AvatarImage
                      src={session.user.image}
                      alt={session.user.name || session.user.email || "Usuario"}
                    />
                  ) : null}
                  <AvatarFallback className="bg-[#D4420A] text-[#F5F0E8] text-xs font-mono">
                    {getInitials(session.user.name, session.user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#F5F0E8] truncate leading-tight">
                    {session.user.name || "Usuario"}
                  </p>
                  <p className="font-mono text-[10px] text-[#F5F0E8]/35 truncate uppercase tracking-wider">
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
      </div>
    </div>
  );
}
