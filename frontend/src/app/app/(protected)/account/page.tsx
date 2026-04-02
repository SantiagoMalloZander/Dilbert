import { AccountSettings } from "@/components/account-settings";
import { ErrorState } from "@/components/error-state";
import { requireSession } from "@/lib/workspace-auth";
import { getAccountPageData } from "@/lib/workspace-account";
import { getFriendlyWorkspaceErrorMessage } from "@/lib/workspace-session-security";

export default async function AccountPage() {
  const session = await requireSession();
  let data: Awaited<ReturnType<typeof getAccountPageData>>;

  try {
    data = await getAccountPageData({
      userId: session.user.id,
      companyId: session.user.companyId,
      email: session.user.email,
      role: session.user.role,
    });
  } catch (error) {
    return (
      <ErrorState
        title="No pudimos cargar tu perfil"
        message={getFriendlyWorkspaceErrorMessage(error)}
      />
    );
  }

  return <AccountSettings initialData={data} />;
}
