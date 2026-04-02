import type { DefaultSession } from "next-auth";
import type { ImpersonationPayload } from "@/lib/workspace-impersonation";
import type { AppRole } from "@/lib/workspace-roles";

declare module "next-auth" {
  interface User {
    role: AppRole;
    companyId: string;
    isSuperAdmin: boolean;
    impersonation?: ImpersonationPayload;
  }

  interface Session {
    user: DefaultSession["user"] & {
      role: AppRole;
      companyId: string;
      isSuperAdmin: boolean;
      impersonation?: ImpersonationPayload;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppRole;
    companyId?: string;
    isSuperAdmin?: boolean;
  }
}
