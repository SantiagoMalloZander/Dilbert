import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth-screen";
import { getAuthSession } from "@/lib/workspace-auth";

export default async function AuthPage({
  searchParams,
}: {
  searchParams?: Promise<{
    timeout?: string;
    step?: "email" | "login" | "register" | "otp";
    email?: string;
    pending_access?: string;
    oauth_error?: string;
  }>;
}) {
  const session = await getAuthSession();
  const resolvedSearchParams = (await searchParams) ?? {};

  if (session?.user?.email) {
    if (session.user.isSuperAdmin && !session.user.companyId) {
      redirect("/app/admin");
    }

    redirect("/app/crm");
  }

  return (
    <AuthScreen
      googleReady={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
      microsoftReady={Boolean(
        process.env.MICROSOFT_CLIENT_ID &&
          process.env.MICROSOFT_CLIENT_SECRET &&
          process.env.MICROSOFT_TENANT_ID
      )}
      timeout={resolvedSearchParams.timeout === "1"}
      initialEmail={resolvedSearchParams.email || ""}
      initialStep={resolvedSearchParams.step || "email"}
      pendingAccess={resolvedSearchParams.pending_access === "1"}
      oauthError={resolvedSearchParams.oauth_error}
    />
  );
}
