import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/workspace-auth";
import { renderDesignEmail } from "@/lib/prospecting/email-design";
import {
  buildUnsubscribeUrl,
  getDailyLimit,
  getOutreachSender,
  isOutreachMailerConfigured,
  renderTemplate,
  sendOutreachEmail,
} from "@/lib/prospecting/mailer";
import {
  countSentToday,
  getProspectsByIds,
  logProspectEmail,
  updateProspect,
  wasEmailAlreadyContacted,
} from "@/modules/prospecting/queries";

// Un mail por request. El panel los manda de a uno con una pausa entre cada uno
// (más humano para Gmail y sin pasarse del timeout de Netlify).
const sendSchema = z.object({
  id: z.string().uuid().optional(),
  test: z.boolean().optional(),
  subject: z.string().min(3, "Falta el asunto.").max(200),
  body: z.string().min(20, "El mail es demasiado corto.").max(10000),
  design: z.boolean().optional(),
});

/** Arma el contenido: diseño Dilvert (HTML) o texto plano de la plantilla. */
function buildContent(
  payload: { body: string; design?: boolean },
  vars: { nombre: string; ciudad: string },
  unsubscribeToken: string | null
) {
  if (!payload.design) return { body: renderTemplate(payload.body, vars), designHtml: undefined };
  const { html, text } = renderDesignEmail({
    ...vars,
    unsubscribeUrl: unsubscribeToken ? buildUnsubscribeUrl(unsubscribeToken) : null,
  });
  return { body: text, designHtml: html };
}

const BLOCKED_STATUSES = new Set(["unsubscribed", "discarded", "bounced", "replied"]);

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  if (!isOutreachMailerConfigured()) {
    return NextResponse.json(
      { error: "Falta configurar OUTREACH_SMTP_USER y OUTREACH_SMTP_PASS en Netlify." },
      { status: 500 }
    );
  }

  let payload: z.infer<typeof sendSchema>;
  try {
    payload = sendSchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : "Pedido inválido.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Mail de prueba: va a la propia casilla, con datos de ejemplo.
  if (payload.test) {
    const sender = getOutreachSender();
    const vars = { nombre: "Inmobiliaria Ejemplo", ciudad: "Pinamar" };
    try {
      await sendOutreachEmail({
        to: session.user.email ?? sender.email ?? "",
        subject: `[PRUEBA] ${renderTemplate(payload.subject, vars)}`,
        ...buildContent(payload, vars, null),
        unsubscribeToken: null,
      });
      return NextResponse.json({ ok: true, status: "sent" });
    } catch (error) {
      console.error("[prospecting] test send failed", error);
      return NextResponse.json(
        { error: `No se pudo mandar la prueba: ${error instanceof Error ? error.message : "error SMTP"}` },
        { status: 500 }
      );
    }
  }

  if (!payload.id) {
    return NextResponse.json({ error: "Falta el prospecto." }, { status: 400 });
  }

  const [prospect] = await getProspectsByIds([payload.id]);
  if (!prospect) {
    return NextResponse.json({ error: "Prospecto no encontrado." }, { status: 404 });
  }

  if (!prospect.email) {
    return NextResponse.json({ ok: true, status: "skipped", reason: "sin email" });
  }
  if (BLOCKED_STATUSES.has(prospect.status)) {
    return NextResponse.json({ ok: true, status: "skipped", reason: prospect.status });
  }
  if (await wasEmailAlreadyContacted(prospect.email)) {
    if (prospect.status === "new") await updateProspect(prospect.id, { status: "sent" });
    return NextResponse.json({ ok: true, status: "skipped", reason: "ya contactado" });
  }

  const dailyLimit = getDailyLimit();
  if ((await countSentToday()) >= dailyLimit) {
    return NextResponse.json(
      { error: `Llegaste al límite diario de ${dailyLimit} mails. Seguí mañana.`, limitReached: true },
      { status: 429 }
    );
  }

  const vars = { nombre: prospect.name, ciudad: prospect.town || "tu zona" };
  const subject = renderTemplate(payload.subject, vars);

  try {
    await sendOutreachEmail({
      to: prospect.email,
      subject,
      ...buildContent(payload, vars, prospect.unsubscribe_token),
      unsubscribeToken: prospect.unsubscribe_token,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "error SMTP";
    await logProspectEmail({
      prospectId: prospect.id,
      toEmail: prospect.email,
      subject,
      status: "failed",
      error: message.slice(0, 500),
    });
    return NextResponse.json({ ok: false, status: "failed", error: message }, { status: 502 });
  }

  await logProspectEmail({ prospectId: prospect.id, toEmail: prospect.email, subject, status: "sent" });
  const updated = await updateProspect(prospect.id, {
    status: "sent",
    send_count: (prospect.send_count ?? 0) + 1,
    last_contacted_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, status: "sent", prospect: updated });
}
