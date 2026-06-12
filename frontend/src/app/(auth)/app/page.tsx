import { redirect } from "next/navigation";
import { AuthFlow } from "@/components/auth/AuthFlow";
import { getAuthSession } from "@/lib/workspace-auth";

export default async function AuthPage({
  searchParams,
}: {
  searchParams?: Promise<{
    timeout?: string;
    step?: string;
    email?: string;
    oauth_error?: string;
    join?: string;
    revoked?: string;
    otp_type?: "signup" | "magiclink";
  }>;
}) {
  const session = await getAuthSession();
  const resolvedSearchParams = (await searchParams) ?? {};

  // Only a few steps are safe to deep-link into; everything else starts at email.
  const allowedSteps = new Set(["email", "login", "otp"]);
  const initialStep = allowedSteps.has(resolvedSearchParams.step || "")
    ? (resolvedSearchParams.step as "email" | "login" | "otp")
    : "email";

  if (session?.user?.email) {
    if (session.user.isSuperAdmin) {
      redirect("/app/admin");
    }

    if (!session.user.companyId) {
      redirect("/app/pending-access");
    }

    // Owner sin plan activo → directo a elegir plan y pagar (onboarding).
    if (session.user.role === "owner" && !session.user.billingActive) {
      redirect("/app/suscripcion");
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
      initialStep={initialStep}
      initialJoinToken={resolvedSearchParams.join || ""}
      initialOtpType={resolvedSearchParams.otp_type || "signup"}
      oauthError={resolvedSearchParams.oauth_error}
      revoked={resolvedSearchParams.revoked === "1"}
    />
  );
}
