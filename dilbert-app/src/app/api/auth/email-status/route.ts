import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppUserByEmail, normalizeEmail } from "@/lib/auth-flow";
import { isSuperAdminEmail } from "@/lib/roles";

const emailStatusSchema = z.object({
  email: z.string().email("Ingresá un email válido."),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = emailStatusSchema.parse(body);
    const normalizedEmail = normalizeEmail(email);

    if (isSuperAdminEmail(normalizedEmail)) {
      return NextResponse.json({
        exists: true,
      });
    }

    const user = await getAppUserByEmail(normalizedEmail);

    return NextResponse.json({
      exists: Boolean(user),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Datos inválidos." },
        { status: 400 }
      );
    }

    console.error("[auth/email-status]", error);
    return NextResponse.json(
      { error: "No pude validar ese email en este momento." },
      { status: 500 }
    );
  }
}
