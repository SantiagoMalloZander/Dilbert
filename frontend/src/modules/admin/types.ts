import type { AdminCompanyRecord, AdminVendorRecord } from "@/modules/admin/queries";

export type Result<T> = {
  data: T | null;
  error: string | null;
};

export type { AdminCompanyRecord, AdminVendorRecord };
