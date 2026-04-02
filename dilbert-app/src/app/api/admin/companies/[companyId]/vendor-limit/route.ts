import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth";
import { updateCompanyVendorLimit } from "@/lib/admin";

const vendorLimitSchema = z.object({
  vendorLimit: z.coerce.number().int().min(1, "El límite de vendedores debe ser al menos 1."),
});

export async function PATCH(
  request: Request,
  { params }: { params: { companyId: string } }
) {
  const session = await getAuthSession();

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { vendorLimit } = vendorLimitSchema.parse(body);

    await updateCompanyVendorLimit(params.companyId, vendorLimit);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Datos inválidos." },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "VENDOR_LIMIT_BELOW_ACTIVE_COUNT") {
      return NextResponse.json(
        { error: "No podés fijar un límite menor a la cantidad de vendedores activos." },
        { status: 409 }
      );
    }

    console.error("[admin/update-vendor-limit]", error);
    return NextResponse.json(
      { error: "No pude actualizar el límite de vendedores." },
      { status: 500 }
    );
  }
}
