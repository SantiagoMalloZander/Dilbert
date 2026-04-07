// @ts-nocheck
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "dilbert_session";
const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dilbert-hackitba-secret-2026"
);

export type UserRole = "admin" | "jurado";

export type SessionUser = {
  username: string;
  companyName: string;
  role: UserRole;
};

// Hardcoded users for the hackathon demo
export const USERS: Record<
  string,
  { password: string; companyName: string; role: UserRole; hubspotKey?: string | undefined }
> = {
  demo: {
    password: "crew",
    companyName: "Demo Company",
    role: "admin",
  },
  "Jurado@hackitba.edu": {
    password: "compi",
    companyName: "hackITBA 2026",
    role: "jurado",
    hubspotKey: process.env.HUBSPOT_JURADO_KEY,
  },
};

export function validateCredentials(
  username: string,
  password: string
): SessionUser | null {
  // Case-insensitive username lookup
  const key = Object.keys(USERS).find(
    (k) => k.toLowerCase() === username.toLowerCase()
  );
  if (!key) return null;
  const user = USERS[key];
  if (user.password !== password) return null;
  return { username: key, companyName: user.companyName, role: user.role };
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(SECRET);
}

export async function verifySessionToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
