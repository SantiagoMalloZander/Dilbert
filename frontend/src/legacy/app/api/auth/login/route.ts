// @ts-nocheck
import { cookies } from "next/headers";
import { validateCredentials, createSessionToken, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  const { username, password } = await request.json();

  const user = validateCredentials(username?.trim(), password);
  if (!user) {
    return Response.json({ error: "Credenciales incorrectas." }, { status: 401 });
  }

  const token = await createSessionToken(user);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  return Response.json({ ok: true });
}
