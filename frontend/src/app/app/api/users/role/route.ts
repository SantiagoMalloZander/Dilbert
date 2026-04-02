import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/workspace-auth";
import { updateCompanyUserRole } from "@/lib/workspace-users";

const updateRoleSchema = z.object({
  email: z.string().email("Ingresá un email válido."),
  role: z.enum(["analyst", "vendor"]),
});

function mapUsersError(error: unknown) {
  if (!(error instanceof Error)) {
    return { status: 500, message: "No pude actualizar el rol." };
  }

  switch (error.message) {
    case "AUTHORIZED_EMAIL_NOT_FOUND":
      return { status: 404, message: "No encontré ese usuario en tu empresa." };
    case "OWNER_ROLE_LOCKED":
      return { status: 409, message: "No podés cambiar el rol del owner." };
    case "VENDOR_LIMIT_REACHED":
      return {
        status: 409,
        message:
          "Límite de vendedores alcanzado. Contactá a Dilbert para ampliar tu plan.",
      };
    default:
      return { status: 500, message: "No pude actualizar el rol." };
  }
}

export async function PATCH(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.email || session.user.role !== "owner" || !session.user.companyId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const payload = updateRoleSchema.parse(body);

    await updateCompanyUserRole({
      companyId: session.user.companyId,
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
    console.error("[users/update-role]", error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
