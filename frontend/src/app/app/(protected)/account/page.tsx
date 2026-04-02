import { AccountSettings } from "@/components/account-settings";
import { requireSession } from "@/lib/workspace-auth";
import { getAccountPageData } from "@/lib/workspace-account";

export default async function AccountPage() {
  const session = await requireSession();
  const data = await getAccountPageData({
    userId: session.user.id,
    companyId: session.user.companyId,
    email: session.user.email,
    role: session.user.role,
  });

  return <AccountSettings initialData={data} />;
}
