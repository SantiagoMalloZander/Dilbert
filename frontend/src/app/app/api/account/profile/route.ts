import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/workspace-auth";
import { updateAccountProfile } from "@/lib/workspace-account";

const updateProfileSchema = z.object({
  fullName: z.string().min(2, "Ingresá tu nombre completo."),
  phone: z.string().optional().nullable(),
});

function mapProfileError(error: unknown) {
  if (!(error instanceof Error)) {
    return { status: 500, message: "No pude guardar tu perfil." };
  }

  switch (error.message) {
    case "ACCOUNT_USER_NOT_FOUND":
      return { status: 404, message: "No encontré tu usuario." };
    case "PROFILE_NAME_REQUIRED":
      return { status: 400, message: "Ingresá tu nombre completo." };
    default:
      return { status: 500, message: "No pude guardar tu perfil." };
  }
}

export async function PATCH(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.email || !session.user.id) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const payload = updateProfileSchema.parse(body);

    const result = await updateAccountProfile({
      userId: session.user.id,
      fullName: payload.fullName,
      phone: payload.phone || null,
    });

    return NextResponse.json({ ok: true, profile: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Datos inválidos." },
        { status: 400 }
      );
    }

    const mapped = mapProfileError(error);
    console.error("[account/profile]", error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
