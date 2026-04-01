import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DAYS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

function humanDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return `${DAYS_ES[dow]} ${d} de ${MONTHS_ES[m - 1]} de ${y}`;
}

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, string>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const { name, company, email, phone, team_size, date, time } = body;

    if (!name?.trim() || !company?.trim() || !email?.trim() || !date || !time) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      return NextResponse.json({ error: "Fecha u hora con formato incorrecto" }, { status: 400 });
    }

    const dateLabel = humanDate(date);

    // ── 1. Guardar en Supabase ──────────────────────────────────────────────
    try {
      const { error: dbErr } = await db().from("demos").insert({
        name: name.trim(),
        company: company.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        team_size: team_size || null,
        date,
        time,
        status: "scheduled",
      });

      if (dbErr) {
        if (dbErr.code === "23505") {
          return NextResponse.json({ error: "Ese horario ya fue reservado. Elegí otro." }, { status: 409 });
        }
        // Log but don't block — email still goes out
        console.error("[book] supabase error:", dbErr.code, dbErr.message);
      }
    } catch (err) {
      console.error("[book] supabase exception:", err);
    }

    // ── 2. Emails via Resend ────────────────────────────────────────────────
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const from = process.env.RESEND_FROM_EMAIL ?? "Dilbert <onboarding@resend.dev>";
        const teamEmail = process.env.TEAM_NOTIFICATION_EMAIL;

        await resend.emails.send({
          from,
          to: email.trim(),
          subject: `Tu demo de Dilbert: ${dateLabel} a las ${time}`,
          html: `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#1A1A1A;color:#F5F0E8;border-radius:12px;">
  <p style="font-family:Arial,sans-serif;font-size:26px;font-weight:900;color:#D4420A;margin:0 0 4px;letter-spacing:0.04em;">DILBERT</p>
  <p style="font-size:11px;color:rgba(245,240,232,0.35);text-transform:uppercase;letter-spacing:0.1em;margin:0 0 28px;">Confirmación de demo</p>
  <p style="font-size:16px;margin:0 0 24px;">Hola <strong>${name.trim()}</strong>, tu demo está confirmada.</p>
  <div style="background:rgba(245,240,232,0.06);border:1px solid rgba(245,240,232,0.1);border-radius:10px;padding:20px;margin:0 0 24px;">
    <p style="margin:0 0 10px;">📅 <strong>${dateLabel}</strong></p>
    <p style="margin:0 0 10px;">⏰ <strong>${time} hs</strong> (Buenos Aires)</p>
    <p style="margin:0;">🏢 ${company.trim()}</p>
  </div>
  <p style="color:rgba(245,240,232,0.5);font-size:14px;line-height:1.65;margin:0 0 8px;">
    Te vamos a enviar el link de la videollamada antes de la reunión.<br>
    Cualquier duda, respondé este email.
  </p>
  <p style="color:rgba(245,240,232,0.18);font-size:11px;margin-top:32px;letter-spacing:0.06em;text-transform:uppercase;">dilbert · tu crm se llena solo</p>
</div>`,
        });

        if (teamEmail) {
          await resend.emails.send({
            from,
            to: teamEmail,
            subject: `🔔 Nueva demo — ${name.trim()} (${company.trim()}) · ${dateLabel} ${time}`,
            html: `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#1A1A1A;color:#F5F0E8;border-radius:12px;">
  <p style="font-family:Arial,sans-serif;font-size:22px;font-weight:900;color:#D4420A;margin:0 0 20px;">Nueva demo agendada</p>
  <table style="width:100%;border-collapse:collapse;">
    ${[
      ["Nombre", name.trim()],
      ["Empresa", company.trim()],
      ["Email", `<a href="mailto:${email}" style="color:#D4420A;">${email}</a>`],
      ["Teléfono", phone?.trim() || "—"],
      ["Equipo", team_size || "—"],
      ["Fecha", `<strong>${dateLabel} a las ${time} hs</strong>`],
    ].map(([label, val]) =>
      `<tr><td style="padding:8px 0;color:rgba(245,240,232,0.35);width:110px;font-size:13px;vertical-align:top;">${label}</td><td style="padding:8px 0;font-size:14px;">${val}</td></tr>`
    ).join("")}
  </table>
</div>`,
          });
        }
      } catch (err) {
        console.error("[book] resend error:", err);
        // Email failed but booking was saved — don't error out
      }
    }

    return NextResponse.json({ ok: true, date: dateLabel, time });
  } catch (err) {
    console.error("[book] unhandled error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
