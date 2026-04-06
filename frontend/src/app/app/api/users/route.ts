import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/workspace-auth";
import { addCompanyUser } from "@/lib/workspace-users";

const addUserSchema = z.object({
  email: z.string().email("Ingresá un email válido."),
  role: z.enum(["analyst", "vendor"]),
});

function mapUsersError(error: unknown) {
  if (!(error instanceof Error)) {
    return { status: 500, message: "No pude agregar el usuario." };
  }

  switch (error.message) {
    case "AUTHORIZED_EMAIL_ALREADY_EXISTS":
      return { status: 409, message: "Ese email ya está agregado en tu empresa." };
    case "EMAIL_BELONGS_TO_OTHER_COMPANY":
      return { status: 409, message: "Ese email ya pertenece a otra empresa en Dilbert." };
    case "VENDOR_LIMIT_REACHED":
      return {
        status: 409,
        message:
          "Límite de vendedores alcanzado. Contactá a Dilbert para ampliar tu plan.",
      };
    case "RESEND_NOT_CONFIGURED":
      return {
        status: 500,
        message: "El servicio de email no está configurado. Contactá a Dilbert.",
      };
    case "COLLABORATOR_AUTH_CREATION_FAILED":
      return {
        status: 500,
        message: "No pude crear la cuenta del usuario. Probá de nuevo.",
      };
    default:
      return { status: 500, message: "No pude agregar el usuario." };
  }
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.email || session.user.role !== "owner" || !session.user.companyId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const payload = addUserSchema.parse(body);

    await addCompanyUser({
      companyId: session.user.companyId,
      addedBy: session.user.id,
      email: payload.email,
      role: payload.role,
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
    console.error("[users/add]", error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
