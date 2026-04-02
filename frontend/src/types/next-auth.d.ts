import type { DefaultSession } from "next-auth";
import type { ImpersonationPayload } from "@/lib/workspace-impersonation";
import type { AppRole } from "@/lib/workspace-roles";

declare module "next-auth" {
  interface User {
    id: string;
    role: AppRole;
    companyId: string;
    isSuperAdmin: boolean;
    impersonation?: ImpersonationPayload;
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: AppRole;
      companyId: string;
      isSuperAdmin: boolean;
      impersonation?: ImpersonationPayload;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
    role?: AppRole;
    companyId?: string;
    isSuperAdmin?: boolean;
  }
}
