import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/workspace-auth";
import { revokeCompanyUserAccess } from "@/modules/users/actions";

const revokeAccessSchema = z.object({
  email: z.string().email("Ingresá un email válido."),
});

function mapUsersError(error: unknown) {
  if (!(error instanceof Error)) {
    return { status: 500, message: "No pude quitar el acceso." };
  }

  switch (error.message) {
    case "AUTHORIZED_EMAIL_NOT_FOUND":
      return { status: 404, message: "No encontré ese usuario en tu empresa." };
    case "OWNER_ACCESS_LOCKED":
      return { status: 409, message: "No podés quitarle acceso al owner." };
    case "SELF_ACCESS_LOCKED":
      return { status: 409, message: "No podés quitarte acceso a vos mismo." };
    default:
      return { status: 500, message: "No pude quitar el acceso." };
  }
}

export async function DELETE(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.email || session.user.role !== "owner" || !session.user.companyId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const payload = revokeAccessSchema.parse(body);

    await revokeCompanyUserAccess({
      companyId: session.user.companyId,
      email: payload.email,
      actorUserId: session.user.id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Datos inválidos." },
        { status: 400 }
      );
    }

    const mapped = mapUsersError(error);
    console.error("[users/revoke-access]", error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
