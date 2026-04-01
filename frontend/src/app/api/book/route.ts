import { NextRequest, NextResponse } from "next/server";

const TZ_OFFSET = 3; // Argentina UTC-3

const DAYS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function argToUtc(dateStr: string, timeStr: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h + TZ_OFFSET, min));
}

function humanDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return `${DAYS_ES[dow]} ${d} de ${MONTHS_ES[m - 1]} de ${y}`;
}

export async function POST(req: NextRequest) {
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

  const startUtc = argToUtc(date, time);
  const endUtc = new Date(startUtc.getTime() + 30 * 60_000);
  const dateLabel = humanDate(date);

  let eventLink = "";

  // ── 1. Google Calendar event ──────────────────────────────────────────────
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    try {
      const { google } = await import("googleapis");
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        },
        scopes: ["https://www.googleapis.com/auth/calendar.events"],
      });

      const cal = google.calendar({ version: "v3", auth });
      const calId = process.env.GOOGLE_CALENDAR_ID ?? "primary";

      const { data } = await cal.events.insert({
        calendarId: calId,
        conferenceDataVersion: 1,
        sendUpdates: "all",
        requestBody: {
          summary: `Demo Dilbert — ${name} (${company})`,
          description: [
            "📋 LEAD DILBERT",
            `Nombre:         ${name}`,
            `Empresa:        ${company}`,
            `Email:          ${email}`,
            `Teléfono:       ${phone || "—"}`,
            `Equipo ventas:  ${team_size || "—"}`,
          ].join("\n"),
          start: {
            dateTime: startUtc.toISOString(),
            timeZone: "America/Argentina/Buenos_Aires",
          },
          end: {
            dateTime: endUtc.toISOString(),
            timeZone: "America/Argentina/Buenos_Aires",
          },
          attendees: [{ email }],
          conferenceData: {
            createRequest: { requestId: `dilbert-${Date.now()}`, conferenceSolutionKey: { type: "hangoutsMeet" } },
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: "email", minutes: 60 },
              { method: "popup", minutes: 15 },
            ],
          },
        },
      });

      eventLink = data.htmlLink ?? "";
    } catch (err) {
      console.error("[book] gcal insert error:", err);
    }
  }

  // ── 2. Emails via Resend ──────────────────────────────────────────────────
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.RESEND_FROM_EMAIL ?? "Dilbert <demos@dilbert.ai>";
      const teamEmail = process.env.TEAM_NOTIFICATION_EMAIL ?? "team@dilbert.ai";

      const calBtn = eventLink
        ? `<a href="${eventLink}" style="display:inline-block;margin-top:20px;background:#D4420A;color:#F5F0E8;padding:12px 24px;border-radius:100px;text-decoration:none;font-weight:700;font-size:14px;">Ver en Google Calendar →</a>`
        : "";

      // Confirmation to visitor
      await resend.emails.send({
        from,
        to: email,
        subject: `Tu demo de Dilbert: ${dateLabel} a las ${time}`,
        html: `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#1A1A1A;color:#F5F0E8;border-radius:12px;">
  <p style="font-family:Anton,sans-serif;font-size:28px;color:#D4420A;margin:0 0 4px;letter-spacing:0.04em;">DILBERT</p>
  <p style="font-size:11px;color:rgba(245,240,232,0.4);text-transform:uppercase;letter-spacing:0.1em;margin:0 0 28px;">Confirmación de demo</p>
  <p style="font-size:16px;margin:0 0 24px;">Hola <strong>${name}</strong>, tu demo está confirmada.</p>
  <div style="background:rgba(245,240,232,0.06);border:1px solid rgba(245,240,232,0.1);border-radius:10px;padding:20px;margin:0 0 24px;">
    <p style="margin:0 0 10px;">📅 <strong>${dateLabel}</strong></p>
    <p style="margin:0 0 10px;">⏰ <strong>${time} hs</strong> (Buenos Aires)</p>
    <p style="margin:0;">🏢 ${company}</p>
  </div>
  <p style="color:rgba(245,240,232,0.55);font-size:14px;line-height:1.6;margin:0 0 8px;">
    Te vamos a enviar el link de la videollamada antes de la reunión.<br>
    Cualquier duda, respondé este email.
  </p>
  ${calBtn}
  <p style="color:rgba(245,240,232,0.2);font-size:11px;margin-top:32px;letter-spacing:0.06em;text-transform:uppercase;">dilbert.ai · tu crm se llena solo</p>
</div>`,
      });

      // Notification to team
      await resend.emails.send({
        from,
        to: teamEmail,
        subject: `🔔 Nueva demo — ${name} (${company}) · ${dateLabel} ${time}`,
        html: `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#1A1A1A;color:#F5F0E8;border-radius:12px;">
  <p style="font-family:Anton,sans-serif;font-size:24px;color:#D4420A;margin:0 0 20px;">Nueva demo agendada</p>
  <table style="width:100%;border-collapse:collapse;">
    ${[
      ["Nombre", name],
      ["Empresa", company],
      ["Email", `<a href="mailto:${email}" style="color:#D4420A;">${email}</a>`],
      ["Teléfono", phone || "—"],
      ["Equipo ventas", team_size || "—"],
      ["Fecha", `<strong>${dateLabel} a las ${time} hs</strong>`],
    ]
      .map(
        ([label, val]) =>
          `<tr><td style="padding:8px 0;color:rgba(245,240,232,0.4);width:130px;font-size:13px;">${label}</td><td style="padding:8px 0;font-size:14px;">${val}</td></tr>`
      )
      .join("")}
  </table>
  ${calBtn}
</div>`,
      });
    } catch (err) {
      console.error("[book] resend error:", err);
    }
  }

  return NextResponse.json({ ok: true, date: dateLabel, time });
}
