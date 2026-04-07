import type {
  CompanyUserRecord,
  CompanyUserState,
  InviteLinkRecord,
  UsersCenterData,
} from "@/modules/users/queries";

export type Result<T> = {
  data: T | null;
  error: string | null;
};

export type { CompanyUserRecord, CompanyUserState, InviteLinkRecord, UsersCenterData };
