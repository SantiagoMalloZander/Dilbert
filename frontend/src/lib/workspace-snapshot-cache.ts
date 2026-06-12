/**
 * Signed, short-lived cache of the per-request workspace checks the middleware
 * used to do on every navigation (users.is_active + auth session_revoked_at).
 *
 * Those two checks each cost a round-trip to Supabase (Oregon ≈ 0.5–1.5s from
 * South America). We cache their result in a signed cookie with a 60s TTL, so
 * the middleware only re-fetches once a minute per user instead of on every
 * click and every Next.js prefetch.
 *
 * Security trade-off: a revocation / deactivation takes up to 60s to take
 * effect. That's the agreed window. The cookie is HMAC-signed (HS256 via jose,
 * edge-compatible) so it can't be forged, and it's bound to the user id — a
 * snapshot for another uid is ignored.
 */

import { SignJWT, jwtVerify } from "jose";

const SIGNING_SECRET =
  process.env.NEXTAUTH_SECRET ||
  process.env.AUTH_SECRET ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "";

const secretKey = SIGNING_SECRET ? new TextEncoder().encode(SIGNING_SECRET) : null;

export const WORKSPACE_SNAPSHOT_COOKIE = "dilbert-wsnap";
const TTL_SECONDS = 60;

export interface WorkspaceSnapshot {
  /** auth user id this snapshot belongs to */
  uid: string;
  companyId: string | null;
  role: string | null;
  isActive: boolean;
  /** session_revoked_at from auth app_metadata, ISO string or null */
  revokedAt: string | null;
  /** Company display name (so the RSC shell doesn't re-query it). */
  companyName: string | null;
  /** Whether billing grants access (exempt or active sub) — for the paywall. */
  billingActive: boolean;
}

export async function signWorkspaceSnapshot(snap: WorkspaceSnapshot): Promise<string | null> {
  if (!secretKey) return null;
  try {
    return await new SignJWT({ ...snap })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${TTL_SECONDS}s`)
      .sign(secretKey);
  } catch {
    return null;
  }
}

/**
 * Returns the cached snapshot if the cookie is present, valid, unexpired and
 * belongs to `expectedUid`. Otherwise null (caller must re-fetch).
 */
export async function readWorkspaceSnapshot(
  token: string | undefined,
  expectedUid: string
): Promise<WorkspaceSnapshot | null> {
  if (!token || !secretKey) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (payload.uid !== expectedUid) return null;
    return {
      uid: payload.uid as string,
      companyId: (payload.companyId as string | null) ?? null,
      role: (payload.role as string | null) ?? null,
      isActive: payload.isActive !== false,
      revokedAt: (payload.revokedAt as string | null) ?? null,
      companyName: (payload.companyName as string | null) ?? null,
      billingActive: payload.billingActive !== false,
    };
  } catch {
    return null;
  }
}
