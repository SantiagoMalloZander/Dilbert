import { NextResponse } from "next/server";
import { z } from "zod";
import { getCompanyById } from "@/lib/workspace-admin";
import { getAuthSession } from "@/lib/workspace-auth";
import {
  IMPERSONATION_COOKIE,
  serializeImpersonationPayload,
} from "@/lib/workspace-impersonation";

const impersonationSchema = z.object({
  companyId: z.string().uuid("Empresa inválida."),
});

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { companyId } = impersonationSchema.parse(body);
    const company = await getCompanyById(companyId);

    if (!company) {
      return NextResponse.json(
        { error: "No encontré esa empresa." },
        { status: 404 }
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      IMPERSONATION_COOKIE,
      serializeImpersonationPayload({
        companyId: company.id,
        companyName: company.name,
        startedAt: new Date().toISOString(),
      }),
      {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 12 * 60 * 60,
      }
    );

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Datos inválidos." },
        { status: 400 }
      );
    }

    console.error("[admin/impersonation:start]", error);
    return NextResponse.json(
      { error: "No pude iniciar el modo owner." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(IMPERSONATION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
