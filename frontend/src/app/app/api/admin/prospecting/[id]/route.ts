import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/workspace-auth";
import { PROSPECT_STATUSES, updateProspect } from "@/modules/prospecting/queries";

const patchSchema = z.object({
  email: z.string().email("Email inválido.").nullable().optional(),
  status: z.enum(PROSPECT_STATUSES).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const payload = patchSchema.parse(await request.json());
    const prospect = await updateProspect(id, {
      ...payload,
      email: payload.email === undefined ? undefined : payload.email?.toLowerCase() ?? null,
    });
    return NextResponse.json({ ok: true, prospect });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }
    console.error("[prospecting] update failed", error);
    return NextResponse.json({ error: "No pude actualizar el prospecto." }, { status: 500 });
  }
}
