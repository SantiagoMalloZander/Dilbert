import { InactivityGuard } from "@/components/inactivity-guard";
import { AppShell } from "@/components/app-shell";
import { ErrorState } from "@/components/error-state";
import { requireSession } from "@/lib/workspace-auth";
import { getFriendlyWorkspaceErrorMessage } from "@/lib/workspace-session-security";
import { getCompanyById } from "@/modules/admin/queries";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  let companyName: string | null = null;

  console.log("[ProtectedLayout] Session loaded:", {
    userId: session.user.id,
    email: session.user.email,
    companyId: session.user.companyId,
    role: session.user.role,
    isSuperAdmin: session.user.isSuperAdmin,
  });

  if (session.user.companyId) {
    try {
      const company = await getCompanyById(session.user.companyId);
      companyName = company?.name || null;
      console.log("[ProtectedLayout] Company loaded:", { companyName });
    } catch (error) {
      console.error("[ProtectedLayout] Failed to load company:", {
        companyId: session.user.companyId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return (
        <>
          <InactivityGuard />
          <ErrorState
            title="No pudimos cargar tu empresa"
            message={getFriendlyWorkspaceErrorMessage(error)}
          />
        </>
      );
    }
  }

  return (
    <>
      <InactivityGuard />
      <AppShell session={session} companyName={companyName}>
        {children}
      </AppShell>
    </>
  );
}
