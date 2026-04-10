import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/workspace-auth";
import {
  createEvolutionInstance,
  getInstanceQrCode,
} from "@/lib/evolution-api";

const schema = z.object({
  channelType: z.enum(["whatsapp_business", "whatsapp_personal"]),
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

    // Wait for instance to initialize before requesting QR
    await sleep(3000);

    // Retry QR up to 4 times with 2s delay between attempts
    let qrCode = "";
    for (let attempt = 0; attempt < 4; attempt++) {
      qrCode = await getInstanceQrCode(instanceName);
      if (qrCode) break;
      await sleep(2000);
    }

    return NextResponse.json({ instanceName, qrCode });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    }
    console.error("[whatsapp/connect]", error);
    return NextResponse.json(
      { error: "No pude iniciar la conexión con WhatsApp." },
      { status: 500 }
    );
  }
}
