import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/workspace-auth";
import {
  connectVendorIntegration,
  disconnectVendorIntegration,
} from "@/lib/workspace-integrations";

const connectIntegrationSchema = z.object({
  channelType: z.enum([
    "whatsapp",
    "whatsapp_personal",
    "gmail",
    "instagram",
    "meet",
    "zoom",
    "teams",
  ]),
  credentials: z.record(z.string(), z.string()),
});

const disconnectIntegrationSchema = z.object({
  channelType: z.enum([
    "whatsapp",
    "whatsapp_personal",
    "gmail",
    "instagram",
    "meet",
    "zoom",
    "teams",
  ]),
});

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.email || !session.user.id || session.user.role !== "vendor") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  if (!session.user.companyId) {
    return NextResponse.json({ error: "Tu cuenta no tiene empresa asignada." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const payload = connectIntegrationSchema.parse(body);

    await connectVendorIntegration({
      userId: session.user.id,
      companyId: session.user.companyId,
      channelType: payload.channelType,
      credentials: payload.credentials,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Datos inválidos." },
        { status: 400 }
      );
    }

    console.error("[integrations/connect]", error);
    return NextResponse.json(
      { error: "No pude guardar la configuración del canal." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.email || !session.user.id || session.user.role !== "vendor") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  if (!session.user.companyId) {
    return NextResponse.json({ error: "Tu cuenta no tiene empresa asignada." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const payload = disconnectIntegrationSchema.parse(body);

    await disconnectVendorIntegration({
      userId: session.user.id,
      companyId: session.user.companyId,
      channelType: payload.channelType,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Datos inválidos." },
        { status: 400 }
      );
    }

    console.error("[integrations/disconnect]", error);
    return NextResponse.json(
      { error: "No pude desconectar el canal." },
      { status: 500 }
    );
  }
}
