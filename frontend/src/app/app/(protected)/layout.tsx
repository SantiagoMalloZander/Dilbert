import { InactivityGuard } from "@/components/inactivity-guard";
import { AppShell } from "@/components/app-shell";
import { ErrorState } from "@/components/error-state";
import { requireSession } from "@/lib/workspace-auth";
import { getCompanyById } from "@/lib/workspace-admin";
import { getFriendlyWorkspaceErrorMessage } from "@/lib/workspace-session-security";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  let companyName: string | null = null;

  if (session.user.companyId) {
    try {
      const company = await getCompanyById(session.user.companyId);
      companyName = company?.name || null;
    } catch (error) {
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
