import { NextResponse } from "next/server";
import { z } from "zod";
import { finalizeRegistration, normalizeEmail } from "@/lib/workspace-auth-flow";

const verifyOtpSchema = z.object({
  email: z.string().email("Ingresá un email válido."),
  otp: z
    .string()
    .regex(/^\d{6}$/, "Ingresá el código de 6 dígitos."),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, otp } = verifyOtpSchema.parse(body);

    const result = await finalizeRegistration({
      email: normalizeEmail(email),
      otp,
    });

    switch (result.status) {
      case "authorized":
        return NextResponse.json({
          ok: true,
          status: result.status,
          sessionToken: result.sessionToken,
        });
      case "pending_access":
        return NextResponse.json({
          ok: true,
          status: result.status,
          message:
            "Tu empresa todavía no te habilitó el acceso. Compartiles este mail y pediles que te agreguen en el Centro de Usuarios.",
        });
      case "not_found":
        return NextResponse.json(
          { error: "No encontré una verificación pendiente para ese email." },
          { status: 404 }
        );
      case "expired":
        return NextResponse.json(
          { error: "El código venció. Pedí uno nuevo." },
          { status: 410 }
        );
      case "invalid_code":
      default:
        return NextResponse.json(
          { error: "El código es incorrecto." },
          { status: 400 }
        );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Datos inválidos." },
        { status: 400 }
      );
    }

    console.error("[auth/verify-otp]", error);
    return NextResponse.json(
      { error: "No pude verificar el código ahora." },
      { status: 500 }
    );
  }
}
