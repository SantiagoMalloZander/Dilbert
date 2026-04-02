import { NextResponse } from "next/server";
import { demoteVendor } from "@/lib/admin";
import { getAuthSession } from "@/lib/auth";

export async function POST(
  _request: Request,
  { params }: { params: { companyId: string; userId: string } }
) {
  const session = await getAuthSession();

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    await demoteVendor({
      companyId: params.companyId,
      userId: params.userId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "VENDOR_NOT_FOUND" || error.message === "VENDOR_COMPANY_MISMATCH")
    ) {
      return NextResponse.json(
        { error: "No encontré ese vendedor en la empresa seleccionada." },
        { status: 404 }
      );
    }

    console.error("[admin/deactivate-vendor]", error);
    return NextResponse.json(
      { error: "No pude dar de baja al vendedor." },
      { status: 500 }
    );
  }
}
