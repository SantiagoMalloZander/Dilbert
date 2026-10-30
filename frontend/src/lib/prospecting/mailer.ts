import nodemailer, { type Transporter } from "nodemailer";

export { DEFAULT_BODY, DEFAULT_SUBJECT, renderTemplate } from "@/lib/prospecting/template";

// Envío de la campaña de prospección por SMTP (Gmail / Google Workspace / Zoho…).
// A propósito NO usa Resend: Resend prohíbe listas no opt-in y esa misma cuenta
// manda los códigos de login de la app; si la suspenden se cae el login.
//
// Envs:
//   OUTREACH_SMTP_USER   cuenta que envía (ej. santi@dilvert.com)
//   OUTREACH_SMTP_PASS   contraseña de aplicación (Gmail: myaccount.google.com/apppasswords)
//   OUTREACH_SMTP_HOST   default smtp.gmail.com
//   OUTREACH_SMTP_PORT   default 465
//   OUTREACH_FROM_NAME   default "Santi de Dilvert"
//   OUTREACH_DAILY_LIMIT default 80 (Gmail personal corta en ~500/día; mejor ir de a poco)

export function getDailyLimit() {
  const value = Number(process.env.OUTREACH_DAILY_LIMIT);
  return Number.isFinite(value) && value > 0 ? value : 80;
}

export function isOutreachMailerConfigured() {
  return Boolean(process.env.OUTREACH_SMTP_USER && process.env.OUTREACH_SMTP_PASS);
}

export function getOutreachSender() {
  return {
    email: process.env.OUTREACH_SMTP_USER ?? null,
    name: process.env.OUTREACH_FROM_NAME || "Santi de Dilvert",
  };
}

let transporter: Transporter | null = null;

function getTransporter() {
  if (!isOutreachMailerConfigured()) throw new Error("OUTREACH_SMTP_NOT_CONFIGURED");
  if (!transporter) {
    const port = Number(process.env.OUTREACH_SMTP_PORT) || 465;
    transporter = nodemailer.createTransport({
      host: process.env.OUTREACH_SMTP_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: {
        user: process.env.OUTREACH_SMTP_USER,
        pass: process.env.OUTREACH_SMTP_PASS,
      },
    });
  }
  return transporter;
}

function getAppUrl() {
  return (process.env.OUTREACH_PUBLIC_URL || "https://dilvert.xyz").replace(/\/$/, "");
}

export function buildUnsubscribeUrl(token: string) {
  return `${getAppUrl()}/api/baja?t=${encodeURIComponent(token)}`;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendOutreachEmail(input: {
  to: string;
  subject: string;
  body: string;
  unsubscribeToken: string | null;
}) {
  const sender = getOutreachSender();
  const unsubscribeUrl = input.unsubscribeToken ? buildUnsubscribeUrl(input.unsubscribeToken) : null;
  const footerText = unsubscribeUrl
    ? `\n\n—\nSi no quieren recibir más mails míos, pueden darse de baja acá: ${unsubscribeUrl}`
    : "";

  // Texto plano + HTML mínimo: parece un mail escrito a mano (mejor entregabilidad).
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#222">${escapeHtml(
    input.body
  ).replace(/\n/g, "<br>")}${
    unsubscribeUrl
      ? `<br><br><span style="font-size:12px;color:#888">Si no quieren recibir más mails míos, <a href="${unsubscribeUrl}" style="color:#888">dense de baja acá</a>.</span>`
      : ""
  }</div>`;

  await getTransporter().sendMail({
    from: { name: sender.name, address: sender.email ?? "" },
    to: input.to,
    subject: input.subject,
    text: `${input.body}${footerText}`,
    html,
    headers: unsubscribeUrl
      ? {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }
      : undefined,
  });
}
