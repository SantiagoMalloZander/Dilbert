import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/workspace-auth";
import { updateAccountPassword } from "@/lib/workspace-account";

const passwordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres."),
  confirmPassword: z.string(),
});

function mapPasswordError(error: unknown) {
  if (!(error instanceof Error)) {
    return { status: 500, message: "No pude actualizar la contraseña." };
  }

  switch (error.message) {
    case "CURRENT_PASSWORD_REQUIRED":
      return { status: 400, message: "Ingresá tu contraseña actual." };
    case "CURRENT_PASSWORD_INVALID":
      return { status: 400, message: "La contraseña actual no coincide." };
    case "PASSWORD_WEAK":
      return {
        status: 400,
        message: "La nueva contraseña necesita al menos 1 número y 1 carácter especial.",
      };
    default:
      return { status: 500, message: "No pude actualizar la contraseña." };
  }
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.email || !session.user.id) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const payload = passwordSchema.parse(body);

    if (payload.newPassword !== payload.confirmPassword) {
      return NextResponse.json(
        { error: "Las contraseñas no coinciden." },
        { status: 400 }
      );
    }

    const result = await updateAccountPassword({
      userId: session.user.id,
      email: session.user.email,
      currentPassword: payload.currentPassword,
      newPassword: payload.newPassword,
    });

    return NextResponse.json({
      ok: true,
      message: result.hadPassword
        ? "Contraseña actualizada."
        : "Contraseña agregada a tu cuenta.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Datos inválidos." },
        { status: 400 }
      );
    }

    const mapped = mapPasswordError(error);
    console.error("[account/password]", error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
