import { Buffer } from "buffer";
import { cache } from "react";
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
  normalizeEmail as normalizeAuthFlowEmail,
  prepareOAuthRegistration,
  syncWorkspaceAccessByEmail,
} from "@/lib/workspace-auth-flow";
import {
  BROWSER_SESSION_COOKIE,
  LAST_ACTIVITY_COOKIE,
  OAUTH_INTENT_COOKIE,
  REMEMBER_COOKIE,
} from "@/lib/workspace-activity";
import {
  IMPERSONATION_COOKIE,
  parseImpersonationCookieValue,
} from "@/lib/workspace-impersonation";
import { ensureNextAuthEnvironment } from "@/lib/workspace-auth-env";
import { isSuperAdminEmail, type AppRole } from "@/lib/workspace-roles";
import { createServerSupabaseAuthClient } from "@/lib/workspace-supabase";

const APP_EXTERNAL_BASE_PATH = "/app";
const APP_SIGN_IN_PATH = `${APP_EXTERNAL_BASE_PATH}/`;

ensureNextAuthEnvironment();

const authSecret = process.env.NEXTAUTH_SECRET || "dilbert-app-local-secret";
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const microsoftClientId = process.env.MICROSOFT_CLIENT_ID;
const microsoftClientSecret = process.env.MICROSOFT_CLIENT_SECRET;
const microsoftTenantId = process.env.MICROSOFT_TENANT_ID;

type OAuthIntent = {
  email: string;
  mode: "login" | "register";
  remember: boolean;
  joinToken?: string | null;
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

async function readOAuthIntent(): Promise<OAuthIntent | null> {
  const cookieStore = await cookies();
  const rawValue = cookieStore.get(OAUTH_INTENT_COOKIE)?.value;
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(rawValue, "base64url").toString("utf8")) as OAuthIntent;
  } catch {
    return null;
  }
}

async function validatePasswordLogin(email: string, password: string, joinToken?: string | null) {
  const supabase = createServerSupabaseAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const appUser = await syncWorkspaceAccessByEmail({
    email,
    joinToken,
    authIdentity: {
      id: data.user.id,
      email,
      name:
        String(data.user.user_metadata?.full_name || "").trim() ||
        String(data.user.email || email),
      avatarUrl: String(data.user.user_metadata?.avatar_url || "") || null,
    },
  });

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

  return buildSessionUser(appUser);
}

async function validateRegistrationSession(sessionToken: string) {
  const appUser = await consumeRegistrationSessionToken(sessionToken);
  if (!appUser) {
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
      joinToken: { label: "Join token", type: "text" },
    },
    async authorize(credentials) {
      const email = normalizeAuthFlowEmail(credentials?.email || "");
      const password = String(credentials?.password || "");
      const joinToken = String(credentials?.joinToken || "") || null;

      if (!email || !password) {
        throw new Error("MISSING_CREDENTIALS");
      }

      return validatePasswordLogin(email, password, joinToken);
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

      const intent = await readOAuthIntent();
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

      const existingUser = await syncWorkspaceAccessByEmail({
        email,
        joinToken: intent.joinToken,
        authIdentity: {
          id: user.id || account.providerAccountId || email,
          email,
          name: user.name || email,
          avatarUrl: user.image,
        },
      });

      if (existingUser) {
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
        ...(intent.joinToken ? { join: intent.joinToken } : {}),
      });
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const normalizedEmail = normalizeAuthFlowEmail(user.email);
        const userIsSuperAdmin = Boolean(user.isSuperAdmin || isSuperAdminEmail(normalizedEmail));

        token.email = normalizedEmail;
        token.sub = user.id;
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

      if (token.email && !token.isSuperAdmin) {
        const appUser = await syncWorkspaceAccessByEmail({
          email: token.email,
        });

        token.role = (appUser?.role as AppRole | null) || "analyst";
        token.companyId = appUser?.company_id || "";
        token.isSuperAdmin = false;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.email) {
        const sessionIsSuperAdmin = Boolean(token.isSuperAdmin || isSuperAdminEmail(token.email));

        session.user.id = token.sub || "";
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

export const getAuthSession = cache(async function _getAuthSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return session;
  }

  if (!session.user.isSuperAdmin) {
    // Only sync if the JWT doesn't already have required fields
    // In steady-state (normal user), the JWT has companyId and role, so skip the DB hit
    if (!session.user.companyId || !session.user.role) {
      const appUser = await syncWorkspaceAccessByEmail({
        email: session.user.email,
      });

      if (appUser) {
        session.user.name = appUser.name || session.user.name;
        session.user.email = appUser.email;
        session.user.role = (appUser.role as AppRole | null) || "analyst";
        session.user.companyId = appUser.company_id || "";
        session.user.image = appUser.avatar_url || session.user.image || null;
      } else {
        session.user.role = "analyst";
        session.user.companyId = "";
      }
    }
  }

  session.user.isSuperAdmin = Boolean(
    session.user.isSuperAdmin || isSuperAdminEmail(session.user.email)
  );
  session.user.role = session.user.role || (session.user.isSuperAdmin ? "owner" : "analyst");
  session.user.companyId = session.user.companyId || "";

  if (session.user.isSuperAdmin) {
      const cookieStore = await cookies();
      const impersonation = parseImpersonationCookieValue(
        cookieStore.get(IMPERSONATION_COOKIE)?.value
      );

    if (impersonation) {
      session.user.role = "owner";
      session.user.companyId = impersonation.companyId;
      session.user.impersonation = impersonation;
    }
  }

  return session;
});

export async function requireSession() {
  const session = await getAuthSession();

  if (!session?.user?.email) {
    redirect("/app/");
  }

  return session;
}

export async function requireOwner() {
  const session = await requireSession();

  if (session.user.role !== "owner") {
    redirect("/app/crm");
  }

  return session;
}

export async function requireSuperAdmin() {
  const session = await requireSession();

  if (!session.user.isSuperAdmin) {
    redirect("/app/crm");
  }

  return session;
}

export async function requireVendor() {
  const session = await requireSession();

  if (session.user.role !== "vendor") {
    redirect("/app/crm");
  }

  return session;
}

export async function clearAuthTrackingCookies() {
  const cookieStore = await cookies();
  [
    LAST_ACTIVITY_COOKIE,
    REMEMBER_COOKIE,
    BROWSER_SESSION_COOKIE,
    OAUTH_INTENT_COOKIE,
    IMPERSONATION_COOKIE,
  ].forEach((cookieName) => cookieStore.set(cookieName, "", { path: "/", maxAge: 0 }));
}
