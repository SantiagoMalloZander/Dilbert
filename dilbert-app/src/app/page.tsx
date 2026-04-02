import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth-screen";
import { getAuthSession } from "@/lib/auth";

export default async function AuthPage({
  searchParams,
}: {
  searchParams?: {
    timeout?: string;
    step?: "email" | "login" | "register" | "otp";
    email?: string;
    pending_access?: string;
    oauth_error?: string;
  };
}) {
  const session = await getAuthSession();

  if (session?.user?.email) {
    redirect("/crm");
  }

  return (
    <AuthScreen
      googleReady={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
      microsoftReady={Boolean(
        process.env.MICROSOFT_CLIENT_ID &&
          process.env.MICROSOFT_CLIENT_SECRET &&
          process.env.MICROSOFT_TENANT_ID
      )}
      timeout={searchParams?.timeout === "1"}
      initialEmail={searchParams?.email || ""}
      initialStep={searchParams?.step || "email"}
      pendingAccess={searchParams?.pending_access === "1"}
      oauthError={searchParams?.oauth_error}
    />
  );
}
