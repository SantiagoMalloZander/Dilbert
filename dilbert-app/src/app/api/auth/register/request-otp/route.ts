import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createPendingRegistration,
  getAppUserByEmail,
  normalizeEmail,
} from "@/lib/auth-flow";

const passwordRule = /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const requestOtpSchema = z.object({
  email: z.string().email("Ingresá un email válido."),
  fullName: z.string().min(2, "Ingresá tu nombre completo."),
  password: z
    .string()
    .regex(
      passwordRule,
      "La contraseña debe tener al menos 1 número, 1 carácter especial y 8 caracteres."
    ),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, fullName, password } = requestOtpSchema.parse(body);
    const normalizedEmail = normalizeEmail(email);

    const existingUser = await getAppUserByEmail(normalizedEmail);
    if (existingUser) {
      return NextResponse.json(
        { error: "Ese email ya existe. Iniciá sesión." },
        { status: 409 }
      );
    }

    await createPendingRegistration({
      email: normalizedEmail,
      fullName,
      password,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Datos inválidos." },
        { status: 400 }
      );
    }

    console.error("[auth/request-otp]", error);
    return NextResponse.json(
      { error: "No pude enviar el código ahora. Probá de nuevo." },
      { status: 500 }
    );
  }
}
