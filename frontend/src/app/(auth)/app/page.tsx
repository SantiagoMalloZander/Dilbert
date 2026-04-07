import { redirect } from "next/navigation";
import { AuthFlow } from "@/components/auth/AuthFlow";
import { getAuthSession } from "@/lib/workspace-auth";

export default async function AuthPage({
  searchParams,
}: {
  searchParams?: Promise<{
    timeout?: string;
    step?: "email" | "login" | "register" | "otp";
    email?: string;
    oauth_error?: string;
    join?: string;
    revoked?: string;
    otp_type?: "signup" | "magiclink";
  }>;
}) {
  const session = await getAuthSession();
  const resolvedSearchParams = (await searchParams) ?? {};

  if (session?.user?.email) {
    if (session.user.isSuperAdmin) {
      redirect("/app/admin");
    }

    if (!session.user.companyId) {
      redirect("/app/pending-access");
    }

    redirect("/app/crm");
  }

  return (
    <AuthFlow
      googleReady={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
      microsoftReady={Boolean(
        process.env.MICROSOFT_CLIENT_ID &&
          process.env.MICROSOFT_CLIENT_SECRET &&
          process.env.MICROSOFT_TENANT_ID
      )}
      timeout={resolvedSearchParams.timeout === "1"}
      initialEmail={resolvedSearchParams.email || ""}
      initialStep={resolvedSearchParams.step || "email"}
      initialJoinToken={resolvedSearchParams.join || ""}
      initialOtpType={resolvedSearchParams.otp_type || "signup"}
      oauthError={resolvedSearchParams.oauth_error}
      revoked={resolvedSearchParams.revoked === "1"}
    />
  );
}
