import { NextResponse } from "next/server";
import { deactivateCompany } from "@/modules/admin/actions";
import { getAuthSession } from "@/lib/workspace-auth";

export async function POST(
  _request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const session = await getAuthSession();
  const { companyId } = await context.params;

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    await deactivateCompany(companyId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/deactivate-company]", error);
    return NextResponse.json(
      { error: "No pude dar de baja la empresa." },
      { status: 500 }
    );
  }
}
