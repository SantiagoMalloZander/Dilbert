import { NextResponse } from "next/server";
import { demoteVendor } from "@/modules/admin/actions";
import { getAuthSession } from "@/lib/workspace-auth";

export async function POST(
  _request: Request,
  context: { params: Promise<{ companyId: string; userId: string }> }
) {
  const session = await getAuthSession();
  const { companyId, userId } = await context.params;

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    await demoteVendor({
      companyId,
      userId,
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
