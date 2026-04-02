import { NextResponse } from "next/server";
import { z } from "zod";
import { createCompanyWithOwner } from "@/lib/admin";
import { getAuthSession } from "@/lib/auth";

const createCompanySchema = z.object({
  companyName: z.string().min(2, "Ingresá el nombre de la empresa."),
  ownerEmail: z.string().email("Ingresá un email válido."),
  ownerName: z.string().min(2, "Ingresá el nombre del owner."),
  vendorLimit: z.coerce.number().int().min(1, "El límite de vendedores debe ser al menos 1."),
});

function mapAdminError(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      status: 500,
      message: "No pude crear la empresa ahora.",
    };
  }

  switch (error.message) {
    case "COMPANY_NAME_REQUIRED":
      return { status: 400, message: "Ingresá el nombre de la empresa." };
    case "OWNER_NAME_REQUIRED":
      return { status: 400, message: "Ingresá el nombre del owner." };
    case "OWNER_EMAIL_REQUIRED":
      return { status: 400, message: "Ingresá el email del owner." };
    case "INVALID_VENDOR_LIMIT":
      return { status: 400, message: "El límite de vendedores debe ser al menos 1." };
    case "OWNER_EMAIL_ALREADY_EXISTS":
      return { status: 409, message: "Ese email ya existe en Dilbert." };
    case "RESEND_NOT_CONFIGURED":
      return { status: 500, message: "Resend no está configurado en este entorno." };
    default:
      return {
        status: 500,
        message: "No pude crear la empresa ahora.",
      };
  }
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const payload = createCompanySchema.parse(body);
    const result = await createCompanyWithOwner(payload);

    return NextResponse.json({
      ok: true,
      companyId: result.companyId,
      ownerId: result.ownerId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Datos inválidos." },
        { status: 400 }
      );
    }

    const mappedError = mapAdminError(error);
    console.error("[admin/create-company]", error);
    return NextResponse.json({ error: mappedError.message }, { status: mappedError.status });
  }
}
