/**
 * POST /api/agendar-call   { inmobiliaria, telefono }
 *
 * Called from the public landing ("Agendá una llamada"). Sends a notification
 * email to the founder so they can call the lead back. Kept simple on purpose:
 * just the agency name + phone, no scheduling slots ("cualquier horario").
 */

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const NOTIFY_TO = "mallozandersantiago@gmail.com";

function sanitize(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, max);
}

export async function POST(req: NextRequest) {
  let body: { inmobiliaria?: string; telefono?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const inmobiliaria = sanitize(body.inmobiliaria, 120);
  const telefono = sanitize(body.telefono, 40);

  if (inmobiliaria.length < 2) {
    return NextResponse.json({ error: "Ingresá el nombre de tu inmobiliaria." }, { status: 400 });
  }
  if (telefono.replace(/\D/g, "").length < 6) {
    return NextResponse.json({ error: "Ingresá un teléfono válido." }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    console.error("[agendar-call] Resend no está configurado");
    return NextResponse.json({ error: "No pude agendar ahora. Probá de nuevo." }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const when = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: NOTIFY_TO,
      replyTo: NOTIFY_TO,
      subject: `CALL DILVERT "${inmobiliaria}"`,
      html: `
        <div style="font-family: Inter, Arial, sans-serif; color:#201A13; padding:24px;">
          <h2 style="margin:0 0 16px; color:#D4420A;">Nueva solicitud de llamada</h2>
          <table style="border-collapse:collapse; font-size:15px;">
            <tr><td style="padding:6px 16px 6px 0; color:#6E665B;">Inmobiliaria</td><td style="padding:6px 0; font-weight:600;">${inmobiliaria}</td></tr>
            <tr><td style="padding:6px 16px 6px 0; color:#6E665B;">Teléfono</td><td style="padding:6px 0; font-weight:600;"><a href="tel:${telefono.replace(/\s/g, "")}" style="color:#201A13; text-decoration:none;">${telefono}</a></td></tr>
            <tr><td style="padding:6px 16px 6px 0; color:#6E665B;">Recibido</td><td style="padding:6px 0;">${when}</td></tr>
          </table>
        </div>
      `,
      text: `Nueva solicitud de llamada\nInmobiliaria: ${inmobiliaria}\nTeléfono: ${telefono}\nRecibido: ${when}`,
    });
  } catch (err) {
    console.error("[agendar-call] envío falló:", err);
    return NextResponse.json({ error: "No pude agendar ahora. Probá de nuevo." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
