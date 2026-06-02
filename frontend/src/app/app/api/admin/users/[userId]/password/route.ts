import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/workspace-auth";
import { setUserPassword } from "@/modules/admin/actions";

const passwordSchema = z.object({
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres."),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const session = await getAuthSession();
  const { userId } = await context.params;

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { password } = passwordSchema.parse(body);

    const { email } = await setUserPassword({ userId, newPassword: password });

    return NextResponse.json({ ok: true, email });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Datos inválidos." },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "PASSWORD_WEAK") {
      return NextResponse.json(
        { error: "La contraseña necesita al menos un número y un símbolo." },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "PASSWORD_TOO_SHORT") {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres." },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return NextResponse.json(
        { error: "No encontré ese usuario." },
        { status: 404 }
      );
    }

    console.error("[admin/set-user-password]", error);
    return NextResponse.json(
      { error: "No pude cambiar la contraseña." },
      { status: 500 }
    );
  }
}
