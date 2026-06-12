import { InactivityGuard } from "@/components/inactivity-guard";
import { AppShell } from "@/components/app-shell";
import { BillingPaywall } from "@/components/billing/billing-paywall";
import { RealtimeRefresh } from "@/components/crm/RealtimeRefresh";
import { requireSession } from "@/lib/workspace-auth";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Company name + billing come from the cached session snapshot — no extra
  // DB round-trips here (this layout runs on every protected navigation).
  const session = await requireSession();
  const isOwner = session.user.role === "owner" || session.user.isSuperAdmin;

  return (
    <>
      <InactivityGuard />
      <AppShell session={session} companyName={session.user.companyName}>
        {children}
      </AppShell>
      {session.user.companyId ? (
        <>
          <RealtimeRefresh companyId={session.user.companyId} />
          <BillingPaywall active={session.user.billingActive} isOwner={isOwner} />
        </>
      ) : null}
    </>
  );
}
