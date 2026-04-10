import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/workspace-auth";
import { createEvolutionInstance } from "@/lib/evolution-api";

const schema = z.object({
  channelType: z.enum(["whatsapp_business", "whatsapp_personal"]),
});

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id || session.user.role !== "vendor") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { channelType } = schema.parse(body);

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/app/api/webhooks/whatsapp`;

    const { instanceName } = await createEvolutionInstance({
      isBusinessAccount: channelType === "whatsapp_business",
      webhookUrl,
    });

    // Return instanceName immediately — client will poll /qr separately
    return NextResponse.json({ instanceName });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    }
    console.error("[whatsapp/connect]", error);
    return NextResponse.json(
      { error: "No pude crear la instancia de WhatsApp." },
      { status: 500 }
    );
  }
}
