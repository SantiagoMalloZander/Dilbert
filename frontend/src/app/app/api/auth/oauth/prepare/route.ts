import { Buffer } from "buffer";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  BROWSER_SESSION_COOKIE,
  OAUTH_INTENT_COOKIE,
  REMEMBER_COOKIE,
} from "@/lib/workspace-activity";
import { normalizeEmail } from "@/lib/workspace-auth-flow";

const oauthPrepareSchema = z.object({
  email: z.string().email("Ingresá un email válido."),
  mode: z.enum(["login", "register"]),
  remember: z.boolean().default(true),
  joinToken: z.string().min(8).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, mode, remember, joinToken } = oauthPrepareSchema.parse(body);

    const response = NextResponse.json({ ok: true });
    const cookiePayload = Buffer.from(
      JSON.stringify({
        email: normalizeEmail(email),
        mode,
        remember,
        joinToken: joinToken || null,
      })
    ).toString("base64url");

    response.cookies.set(OAUTH_INTENT_COOKIE, cookiePayload, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });

    response.cookies.set(BROWSER_SESSION_COOKIE, "1", {
      sameSite: "lax",
      path: "/",
    });

    if (remember) {
      response.cookies.set(REMEMBER_COOKIE, "1", {
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
    } else {
      response.cookies.set(REMEMBER_COOKIE, "", {
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    }

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Datos inválidos." },
        { status: 400 }
      );
    }

    console.error("[auth/oauth-prepare]", error);
    return NextResponse.json(
      { error: "No pude iniciar el flujo OAuth." },
      { status: 500 }
    );
  }
}
