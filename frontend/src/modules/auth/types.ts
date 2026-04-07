import type { User } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { AppRole } from "@/lib/workspace-roles";

export type AuthStep = "email" | "login" | "register" | "otp";
export type AuthFlowMode = "login" | "register";
export type AuthOtpType = "signup" | "magiclink";

export type PublicUserRecord = Database["public"]["Tables"]["users"]["Row"];
export type AuthorizedEmailRecord = Database["public"]["Tables"]["authorized_emails"]["Row"];
export type InviteLinkRecord = Database["public"]["Tables"]["invite_links"]["Row"];
export type AuthIdentity = User;

export type WorkspaceAccess = {
  companyId: string;
  role: AppRole;
};

export type EmailStatusResult = {
  exists: boolean;
  email: string;
};

export type RequestOtpResult = {
  ok: true;
  email: string;
  otpType: AuthOtpType;
};

export type RegistrationResult =
  | {
      status: "authorized";
      redirectTo: "/app/admin" | "/app/crm";
      companyId: string;
      role: AppRole;
    }
  | {
      status: "pending_access";
      redirectTo: "/app/pending-access";
      message: string;
    };
