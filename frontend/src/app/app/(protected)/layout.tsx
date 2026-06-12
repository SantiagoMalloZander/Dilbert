import { InactivityGuard } from "@/components/inactivity-guard";
import { AppShell } from "@/components/app-shell";
import { ErrorState } from "@/components/error-state";
import { BillingPaywall } from "@/components/billing/billing-paywall";
import { requireSession } from "@/lib/workspace-auth";
import { getFriendlyWorkspaceErrorMessage } from "@/lib/workspace-session-security";
import { getCompanyById } from "@/modules/admin/queries";
import { getBillingState } from "@/modules/billing/queries";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  let companyName: string | null = null;
  // Companies are exempt/active by default for everyone who already exists, so
  // this never locks out current users; only new, unsubscribed companies see it.
  let billingActive = true;

  if (session.user.companyId) {
    try {
      const [company, billing] = await Promise.all([
        getCompanyById(session.user.companyId),
        getBillingState(session.user.companyId),
      ]);
      companyName = company?.name || null;
      billingActive = billing.active;
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

  const isOwner = session.user.role === "owner" || session.user.isSuperAdmin;

  return (
    <>
      <InactivityGuard />
      <AppShell session={session} companyName={companyName}>
        {children}
      </AppShell>
      {session.user.companyId ? (
        <BillingPaywall active={billingActive} isOwner={isOwner} />
      ) : null}
    </>
  );
}
