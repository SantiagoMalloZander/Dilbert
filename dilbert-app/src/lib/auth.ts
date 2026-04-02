import { Buffer } from "buffer";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  buildSessionUser,
  consumeRegistrationSessionToken,
  getAppUserByEmail,
  normalizeEmail as normalizeAuthFlowEmail,
  prepareOAuthRegistration,
  userHasWorkspaceAccess,
} from "@/lib/auth-flow";
import {
  BROWSER_SESSION_COOKIE,
  LAST_ACTIVITY_COOKIE,
  OAUTH_INTENT_COOKIE,
  REMEMBER_COOKIE,
} from "@/lib/activity";
import {
  IMPERSONATION_COOKIE,
  parseImpersonationCookieValue,
} from "@/lib/impersonation";
import { isSuperAdminEmail, type AppRole } from "@/lib/roles";
import { createServerSupabaseAuthClient } from "@/lib/supabase";

const authSecret = process.env.NEXTAUTH_SECRET || "dilbert-app-local-secret";
const APP_EXTERNAL_BASE_PATH = "/app";
const APP_SIGN_IN_PATH = `${APP_EXTERNAL_BASE_PATH}/`;
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const microsoftClientId = process.env.MICROSOFT_CLIENT_ID;
const microsoftClientSecret = process.env.MICROSOFT_CLIENT_SECRET;
const microsoftTenantId = process.env.MICROSOFT_TENANT_ID;

type OAuthIntent = {
  email: string;
  mode: "login" | "register";
  remember: boolean;
};

function buildSuperAdminSessionUser(params: {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}) {
  return {
    id: params.id,
    email: params.email,
    name: params.name || "Dilbert Admin",
    image: params.image || null,
    role: "owner" as AppRole,
    companyId: "",
    isSuperAdmin: true,
  };
}

function encodeAuthRedirect(params: Record<string, string>) {
  const search = new URLSearchParams(params);
  const query = search.toString();
  return query ? `${APP_SIGN_IN_PATH}?${query}` : APP_SIGN_IN_PATH;
}

function toExternalAppPath(pathname: string) {
  if (pathname.startsWith(APP_EXTERNAL_BASE_PATH)) {
    return pathname;
  }

  if (pathname === "/") {
    return APP_SIGN_IN_PATH;
  }

  return `${APP_EXTERNAL_BASE_PATH}${pathname}`;
}

function readOAuthIntent(): OAuthIntent | null {
  const rawValue = cookies().get(OAUTH_INTENT_COOKIE)?.value;
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(rawValue, "base64url").toString("utf8")) as OAuthIntent;
  } catch {
    return null;
  }
}

async function validatePasswordLogin(email: string, password: string) {
  const supabase = createServerSupabaseAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const appUser = await getAppUserByEmail(email);
  if (!appUser) {
    if (isSuperAdminEmail(email)) {
      return buildSuperAdminSessionUser({
        id: data.user.id,
        email,
        name: String(data.user.user_metadata?.full_name || data.user.email || "Dilbert Admin"),
        image: String(data.user.user_metadata?.avatar_url || "") || null,
      });
    }

    throw new Error("INVALID_CREDENTIALS");
  }

  if (!userHasWorkspaceAccess(appUser)) {
    throw new Error("ACCESS_PENDING");
  }

  return buildSessionUser(appUser);
}

async function validateRegistrationSession(sessionToken: string) {
  const appUser = await consumeRegistrationSessionToken(sessionToken);
  if (!appUser || !userHasWorkspaceAccess(appUser)) {
    throw new Error("REGISTRATION_SESSION_INVALID");
  }

  return buildSessionUser(appUser);
}

const providers: NonNullable<NextAuthOptions["providers"]> = [
  CredentialsProvider({
    id: "credentials",
    name: "Email y contraseña",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Contraseña", type: "password" },
    },
    async authorize(credentials) {
      const email = normalizeAuthFlowEmail(credentials?.email || "");
      const password = String(credentials?.password || "");

      if (!email || !password) {
        throw new Error("MISSING_CREDENTIALS");
      }

      return validatePasswordLogin(email, password);
    },
  }),
  CredentialsProvider({
    id: "registration-token",
    name: "Registro verificado",
    credentials: {
      token: { label: "Token", type: "text" },
    },
    async authorize(credentials) {
      const sessionToken = String(credentials?.token || "");
      if (!sessionToken) {
        throw new Error("REGISTRATION_SESSION_INVALID");
      }

      return validateRegistrationSession(sessionToken);
    },
  }),
];

if (googleClientId && googleClientSecret) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    })
  );
}

if (microsoftClientId && microsoftClientSecret && microsoftTenantId) {
  providers.push(
    AzureADProvider({
      clientId: microsoftClientId,
      clientSecret: microsoftClientSecret,
      tenantId: microsoftTenantId,
    })
  );
}

export const authOptions: NextAuthOptions = {
  secret: authSecret,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: APP_SIGN_IN_PATH,
  },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      const email = normalizeAuthFlowEmail(user.email || "");
      if (!email) {
        return false;
      }

      if (!account) {
        return false;
      }

      if (account.provider === "credentials" || account.provider === "registration-token") {
        return true;
      }

      const intent = readOAuthIntent();
      if (!intent) {
        return encodeAuthRedirect({
          step: "email",
          oauth_error: "missing_intent",
          email,
        });
      }

      if (intent.email !== email) {
        return encodeAuthRedirect({
          step: "email",
          oauth_error: "email_mismatch",
          email: intent.email,
        });
      }

      const existingUser = await getAppUserByEmail(email);
      if (existingUser) {
        if (!userHasWorkspaceAccess(existingUser)) {
          return encodeAuthRedirect({
            step: "login",
            pending_access: "1",
            email,
          });
        }

        return true;
      }

      if (isSuperAdminEmail(email)) {
        return true;
      }

      if (intent.mode !== "register") {
        return encodeAuthRedirect({
          step: "register",
          oauth_error: "not_registered",
          email,
        });
      }

      await prepareOAuthRegistration({
        email,
        fullName: user.name,
        avatarUrl: user.image,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      });

      return encodeAuthRedirect({
        step: "otp",
        email,
      });
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const normalizedEmail = normalizeAuthFlowEmail(user.email);
        const userIsSuperAdmin = Boolean(user.isSuperAdmin || isSuperAdminEmail(normalizedEmail));

        token.email = normalizedEmail;
        token.role = user.role as AppRole;
        token.companyId = user.companyId as string;
        token.isSuperAdmin = userIsSuperAdmin;
        token.name = user.name;
        token.picture = user.image || null;
        return token;
      }

      if (token.email) {
        token.isSuperAdmin = Boolean(token.isSuperAdmin || isSuperAdminEmail(token.email));
      }

      if (token.email && (!token.role || (!token.companyId && !token.isSuperAdmin))) {
        const appUser = await getAppUserByEmail(token.email);
        if (appUser && userHasWorkspaceAccess(appUser)) {
          token.role = appUser.role as AppRole;
          token.companyId = appUser.company_id as string;
          token.isSuperAdmin = isSuperAdminEmail(appUser.email);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.email) {
        const sessionIsSuperAdmin = Boolean(token.isSuperAdmin || isSuperAdminEmail(token.email));

        session.user.email = token.email;
        session.user.role = (token.role as AppRole | undefined) || (sessionIsSuperAdmin ? "owner" : "analyst");
        session.user.companyId = typeof token.companyId === "string" ? token.companyId : "";
        session.user.isSuperAdmin = sessionIsSuperAdmin;
      }

      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${toExternalAppPath(url)}`;
      }

      try {
        const destination = new URL(url);
        if (destination.origin === baseUrl) {
          return url;
        }
      } catch {
        return `${baseUrl}${toExternalAppPath("/crm")}`;
      }

      return `${baseUrl}${toExternalAppPath("/crm")}`;
    },
  },
};

export async function getAuthSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return session;
  }

  session.user.isSuperAdmin = Boolean(
    session.user.isSuperAdmin || isSuperAdminEmail(session.user.email)
  );
  session.user.role = session.user.role || (session.user.isSuperAdmin ? "owner" : "analyst");
  session.user.companyId = session.user.companyId || "";

  if (session.user.isSuperAdmin) {
    const impersonation = parseImpersonationCookieValue(
      cookies().get(IMPERSONATION_COOKIE)?.value
    );

    if (impersonation) {
      session.user.role = "owner";
      session.user.companyId = impersonation.companyId;
      session.user.impersonation = impersonation;
    }
  }

  return session;
}

export async function requireSession() {
  const session = await getAuthSession();

  if (!session?.user?.email) {
    redirect("/");
  }

  return session;
}

export async function requireOwner() {
  const session = await requireSession();

  if (session.user.role !== "owner") {
    redirect("/crm");
  }

  return session;
}

export async function requireSuperAdmin() {
  const session = await requireSession();

  if (!session.user.isSuperAdmin) {
    redirect("/crm");
  }

  return session;
}

export async function requireVendor() {
  const session = await requireSession();

  if (session.user.role !== "vendor") {
    redirect("/crm");
  }

  return session;
}

export function clearAuthTrackingCookies() {
  const cookieStore = cookies();
  [
    LAST_ACTIVITY_COOKIE,
    REMEMBER_COOKIE,
    BROWSER_SESSION_COOKIE,
    OAUTH_INTENT_COOKIE,
    IMPERSONATION_COOKIE,
  ].forEach((cookieName) => cookieStore.set(cookieName, "", { path: "/", maxAge: 0 }));
}
