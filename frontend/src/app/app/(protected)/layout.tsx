import { InactivityGuard } from "@/components/inactivity-guard";
import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/workspace-auth";
import { getCompanyById } from "@/lib/workspace-admin";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const company = session.user.companyId
    ? await getCompanyById(session.user.companyId)
    : null;

  return (
    <>
      <InactivityGuard />
      <AppShell session={session} companyName={company?.name || null}>
        {children}
      </AppShell>
    </>
  );
}
