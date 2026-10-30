import { NextResponse } from "next/server";
import { unsubscribeByToken } from "@/modules/prospecting/queries";

// Baja pública de la campaña de prospección (link al pie de cada mail +
// header List-Unsubscribe one-click, que llega por POST).

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function page(message: string) {
  return new NextResponse(
    `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dilvert</title></head><body style="font-family:Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#f7f7f8;color:#222"><p style="max-width:420px;text-align:center;font-size:16px;line-height:1.5">${message}</p></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

async function handle(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  if (!UUID_REGEX.test(token)) {
    return page("El link de baja no es válido.");
  }

  try {
    await unsubscribeByToken(token);
    return page("Listo, te dimos de baja. No vas a recibir más mails nuestros.");
  } catch (error) {
    console.error("[baja] failed", error);
    return page("No pudimos procesar la baja. Respondé el mail con la palabra BAJA y lo hacemos a mano.");
  }
}

export const GET = handle;
export const POST = handle;
