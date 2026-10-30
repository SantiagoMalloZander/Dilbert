import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/workspace-auth";
import { isGooglePlacesConfigured } from "@/lib/prospecting/sources";
import { getDailyLimit, getOutreachSender, isOutreachMailerConfigured } from "@/lib/prospecting/mailer";
import {
  countSentToday,
  createManualProspect,
  deleteProspects,
  listProspects,
} from "@/modules/prospecting/queries";

const manualSchema = z.object({
  name: z.string().min(2, "Ingresá el nombre de la inmobiliaria."),
  email: z.string().email("Ingresá un email válido."),
  town: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
});

const deleteSchema = z.object({ ids: z.array(z.string().uuid()).min(1) });

async function isSuperAdmin() {
  const session = await getAuthSession();
  return Boolean(session?.user?.isSuperAdmin);
}

export async function GET() {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const [prospects, sentToday] = await Promise.all([listProspects(), countSentToday()]);
    return NextResponse.json({
      prospects,
      config: {
        googleEnabled: isGooglePlacesConfigured(),
        mailerEnabled: isOutreachMailerConfigured(),
        sender: getOutreachSender(),
        dailyLimit: getDailyLimit(),
        sentToday,
      },
    });
  } catch (error) {
    console.error("[prospecting] list failed", error);
    return NextResponse.json(
      { error: "No pude cargar los prospectos. ¿Está aplicada la migración de prospección?" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const payload = manualSchema.parse(await request.json());
    const prospect = await createManualProspect(payload);
    return NextResponse.json({ ok: true, prospect });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }
    console.error("[prospecting] manual create failed", error);
    return NextResponse.json({ error: "No pude guardar el prospecto." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const { ids } = deleteSchema.parse(await request.json());
    await deleteProspects(ids);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[prospecting] delete failed", error);
    return NextResponse.json({ error: "No pude borrar los prospectos." }, { status: 500 });
  }
}
