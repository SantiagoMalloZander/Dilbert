import { NextResponse } from "next/server";
import { deactivateCompany } from "@/lib/admin";
import { getAuthSession } from "@/lib/auth";

export async function POST(
  _request: Request,
  { params }: { params: { companyId: string } }
) {
  const session = await getAuthSession();

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    await deactivateCompany(params.companyId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/deactivate-company]", error);
    return NextResponse.json(
      { error: "No pude dar de baja la empresa." },
      { status: 500 }
    );
  }
}
