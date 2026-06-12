import type { User } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { AppRole } from "@/lib/workspace-roles";

export type AuthStep = "email" | "login" | "choose" | "register-owner" | "register-employee" | "otp";
export type AuthFlowMode = "login" | "register";
export type AuthOtpType = "signup" | "magiclink";
/** Which registration path the OTP belongs to (so we finalize correctly). */
export type AuthIntent = "owner" | "employee" | "login";

export type PublicUserRecord = Database["public"]["Tables"]["users"]["Row"];
export type AuthorizedEmailRecord = Database["public"]["Tables"]["authorized_emails"]["Row"];
export type InviteLinkRecord = Database["public"]["Tables"]["invite_links"]["Row"];
export type AuthIdentity = User;

export type WorkspaceAccess = {
  companyId: string;
  role: AppRole;
};

export type EmailStatusResult = {
  /** An auth user already exists for this email. */
  exists: boolean;
  /** Registration is fully completed (has a workspace user row or is super-admin). */
  verified: boolean;
  /** Pre-authorized by an owner/admin (in authorized_emails) but not yet registered. */
  preAuthorized: boolean;
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
