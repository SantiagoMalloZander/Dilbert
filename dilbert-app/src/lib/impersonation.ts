export const IMPERSONATION_COOKIE = "dilbert-admin-impersonation";

export type ImpersonationPayload = {
  companyId: string;
  companyName: string;
  startedAt: string;
};

export function serializeImpersonationPayload(payload: ImpersonationPayload) {
  return encodeURIComponent(JSON.stringify(payload));
}

export function parseImpersonationCookieValue(rawValue?: string | null) {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(rawValue)) as Partial<ImpersonationPayload>;
    if (
      typeof parsed.companyId !== "string" ||
      typeof parsed.companyName !== "string" ||
      typeof parsed.startedAt !== "string"
    ) {
      return null;
    }

    return {
      companyId: parsed.companyId,
      companyName: parsed.companyName,
      startedAt: parsed.startedAt,
    } satisfies ImpersonationPayload;
  } catch {
    return null;
  }
}
