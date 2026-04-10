import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/workspace-auth";
import { getInstanceQrCode } from "@/lib/evolution-api";

export async function GET(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id || session.user.role !== "vendor") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const instanceName = searchParams.get("instance");

  if (!instanceName) {
    return NextResponse.json({ error: "Parámetro faltante." }, { status: 400 });
  }

  try {
    const qrCode = await getInstanceQrCode(instanceName);
    return NextResponse.json({ qrCode: qrCode || null });
  } catch (error) {
    console.error("[whatsapp/qr]", error);
    return NextResponse.json({ qrCode: null });
  }
}
