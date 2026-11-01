// Mail de campaña con el diseño de Dilvert (HTML + imágenes publicadas en
// public/email/). Lo usan el envío y la vista previa del panel.
// Variables: {{nombre}}, {{ciudad}}, {{baja}}, {{assets}}.

const DESIGN_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dilvert</title>
</head>
<body style="margin:0;padding:0;background:#FBFAF8;">
<div style="display:none;max-height:0;overflow:hidden;color:#FBFAF8;">Una IA que atiende cada consulta, la deriva al vendedor correcto y mide cada propiedad. 15 minutos y te lo muestro.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FBFAF8;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;font-family:Inter,'Helvetica Neue',Arial,sans-serif;color:#201A13;">

  <!-- Logo -->
  <tr><td style="padding:0 8px 20px;">
    <img src="{{assets}}/email/logo.png" width="96" alt="Dilvert" style="display:block;width:96px;height:auto;border:0;">
  </td></tr>

  <!-- Hero -->
  <tr><td style="background:#FFFFFF;border:1px solid rgba(32,26,19,0.10);border-radius:22px;padding:32px 32px 28px;">
    <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#D4420A;">Informe breve · Para {{nombre}}</p>
    <h1 style="margin:0 0 16px;font-size:30px;line-height:1.12;font-weight:800;letter-spacing:-.02em;color:#201A13;">Que ninguna consulta se pierda entre el anuncio y la visita</h1>
    <p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#201A13;">Hola, equipo de {{nombre}}:</p>
    <p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#201A13;">Soy Santi, de <strong>Dilvert</strong>. Armamos una solución integral con inteligencia artificial para inmobiliarias: atiende cada consulta al instante, la deriva al vendedor correcto, completa el CRM sola y le muestra al dueño de cada propiedad cómo viene la venta.</p>
    <p style="margin:0;font-size:16px;line-height:1.6;color:#201A13;">Nos especializamos en inmobiliarias que <strong>ya invierten en anuncios</strong> y tienen <strong>equipos de 5 a 10 personas</strong>. Es donde más se nota el impacto: llegan más consultas de las que el equipo alcanza a responder, seguir y medir.</p>
  </td></tr>

  <tr><td style="height:16px;line-height:16px;font-size:0;">&nbsp;</td></tr>

  <!-- Qué hacemos -->
  <tr><td style="background:#FFFFFF;border:1px solid rgba(32,26,19,0.10);border-radius:22px;padding:28px 32px;">
    <p style="margin:0 0 18px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#D4420A;">Qué hacemos</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td valign="top" width="40" style="padding:0 0 18px;font-size:14px;font-weight:800;color:#D4420A;">01</td>
          <td valign="top" style="padding:0 0 18px;"><p style="margin:0 0 4px;font-size:16px;font-weight:700;">Una asistente de WhatsApp que responde al instante</p>
          <p style="margin:0;font-size:14.5px;line-height:1.55;color:#6E665B;">A cualquier hora, con texto, audios o fotos. Busca en tu catálogo, propone opciones parecidas y recontacta a quien se quedó callado.</p></td></tr>
      <tr><td valign="top" width="40" style="padding:0 0 18px;font-size:14px;font-weight:800;color:#D4420A;">02</td>
          <td valign="top" style="padding:0 0 18px;"><p style="margin:0 0 4px;font-size:16px;font-weight:700;">Cada consulta al vendedor que corresponde</p>
          <p style="margin:0;font-size:14.5px;line-height:1.55;color:#6E665B;">Por zona o por propiedad, repartiendo la carga y con la charla ya resumida. Las tasaciones van directo a quien las maneja.</p></td></tr>
      <tr><td valign="top" width="40" style="padding:0 0 18px;font-size:14px;font-weight:800;color:#D4420A;">03</td>
          <td valign="top" style="padding:0 0 18px;"><p style="margin:0 0 4px;font-size:16px;font-weight:700;">Un CRM que se completa solo</p>
          <p style="margin:0;font-size:14.5px;line-height:1.55;color:#6E665B;">Lee las conversaciones de WhatsApp y mail y carga qué busca cada cliente, zona, presupuesto y visitas. Se actualiza con lo que se mueve en el mercado y con tu catálogo, sin que nadie cargue nada a mano.</p></td></tr>
      <tr><td valign="top" width="40" style="padding:0 0 18px;font-size:14px;font-weight:800;color:#D4420A;">04</td>
          <td valign="top" style="padding:0 0 18px;"><p style="margin:0 0 4px;font-size:16px;font-weight:700;">Números para decidir</p>
          <p style="margin:0;font-size:14.5px;line-height:1.55;color:#6E665B;">Consultas, derivaciones por vendedor, visitas y cierres en un embudo de compras, alquileres y tasaciones, comparando un período contra otro.</p></td></tr>
      <tr><td valign="top" width="40" style="padding:0;font-size:14px;font-weight:800;color:#D4420A;">05</td>
          <td valign="top" style="padding:0;"><p style="margin:0 0 4px;font-size:16px;font-weight:700;">Informes para los propietarios, automáticos</p>
          <p style="margin:0;font-size:14.5px;line-height:1.55;color:#6E665B;">Vistas, consultas y visitas de cada propiedad, con una recomendación de precio basada en ventas comparables. Se generan solos dos veces por mes.</p></td></tr>
    </table>
  </td></tr>

  <tr><td style="height:16px;line-height:16px;font-size:0;">&nbsp;</td></tr>

  <!-- Panel -->
  <tr><td style="background:#FFFFFF;border:1px solid rgba(32,26,19,0.10);border-radius:22px;padding:28px 32px;">
    <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#D4420A;">Así se ve</p>
    <p style="margin:0 0 16px;font-size:20px;line-height:1.25;font-weight:800;letter-spacing:-.01em;">El panel de una inmobiliaria que ya lo usa</p>
    <img src="{{assets}}/email/panel.jpg" width="536" alt="Panel de Dilvert: consultas, derivaciones por vendedor y embudo de ventas" style="display:block;width:100%;max-width:536px;height:auto;border:1px solid rgba(32,26,19,0.10);border-radius:12px;">
    <p style="margin:12px 0 0;font-size:14px;line-height:1.55;color:#6E665B;">Inmobiliaria de Campana, octubre: 110 consultas atendidas, repartidas entre el equipo, y el embudo completo desde el primer mensaje hasta la venta.</p>
  </td></tr>

  <tr><td style="height:16px;line-height:16px;font-size:0;">&nbsp;</td></tr>

  <!-- Informe -->
  <tr><td style="background:#FFFFFF;border:1px solid rgba(32,26,19,0.10);border-radius:22px;padding:28px 32px;">
    <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#D4420A;">Para el propietario</p>
    <p style="margin:0 0 6px;font-size:20px;line-height:1.25;font-weight:800;letter-spacing:-.01em;">Un informe que se arma solo</p>
    <p style="margin:0 0 16px;font-size:14.5px;line-height:1.55;color:#6E665B;">Este es uno real: 166 consultas y ninguna visita. El informe se lo muestra al dueño con datos, lo compara con ventas parecidas del barrio y recomienda un ajuste. La conversación del precio deja de ser una opinión.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="33%" valign="top" style="padding-right:6px;"><img src="{{assets}}/email/informe-1.jpg" width="172" alt="Resumen del informe" style="display:block;width:100%;height:auto;border:1px solid rgba(32,26,19,0.10);border-radius:10px;"></td>
        <td width="33%" valign="top" style="padding:0 3px;"><img src="{{assets}}/email/informe-2.jpg" width="172" alt="Embudo de la propiedad" style="display:block;width:100%;height:auto;border:1px solid rgba(32,26,19,0.10);border-radius:10px;"></td>
        <td width="33%" valign="top" style="padding-left:6px;"><img src="{{assets}}/email/informe-3.jpg" width="172" alt="Recomendación de precio" style="display:block;width:100%;height:auto;border:1px solid rgba(32,26,19,0.10);border-radius:10px;"></td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="height:16px;line-height:16px;font-size:0;">&nbsp;</td></tr>

  <!-- CTA -->
  <tr><td style="background:#201A13;border-radius:22px;padding:32px;">
    <p style="margin:0 0 10px;font-size:22px;line-height:1.25;font-weight:800;letter-spacing:-.01em;color:#FFFFFF;">¿Lo vemos juntos en 15 minutos?</p>
    <p style="margin:0 0 22px;font-size:15.5px;line-height:1.6;color:#D9D3CA;">Escribime para lo que necesites: ver una demo con tus propiedades, preguntarme cómo funciona o contarme cómo trabajan hoy en {{ciudad}}. Respondé este mail o agendá una llamada directamente.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="background:#D4420A;border-radius:999px;"><a href="https://dilvert.xyz/reservar" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;">Agendar una llamada</a></td>
    </tr></table>
  </td></tr>

  <!-- Firma -->
  <tr><td style="padding:24px 8px 0;">
    <p style="margin:0 0 2px;font-size:15px;font-weight:700;">Santi Mallo Zander</p>
    <p style="margin:0;font-size:14px;line-height:1.5;color:#6E665B;">Dilvert · IA y CRM para inmobiliarias · <a href="https://dilvert.xyz" style="color:#D4420A;text-decoration:none;">dilvert.xyz</a></p>
  </td></tr>

  <!--baja-->
  <tr><td style="padding:22px 8px 0;">
    <p style="margin:0;font-size:12px;line-height:1.5;color:#9A9186;">Si no querés recibir más mails míos, <a href="{{baja}}" style="color:#9A9186;">date de baja acá</a>.</p>
  </td></tr>
  <!--/baja-->

</table>
</td></tr>
</table>
</body>
</html>
`;

export const DESIGN_TEXT = `Hola, equipo de {{nombre}}:

Soy Santi, de Dilvert. Armamos una solución integral con inteligencia artificial para inmobiliarias: atiende cada consulta al instante, la deriva al vendedor correcto, completa el CRM sola y le muestra al dueño de cada propiedad cómo viene la venta.

Nos especializamos en inmobiliarias que ya invierten en anuncios y tienen equipos de 5 a 10 personas. Es donde más se nota el impacto: llegan más consultas de las que el equipo alcanza a responder, seguir y medir.

Qué hacemos:
1. Una asistente de WhatsApp que responde al instante, a cualquier hora.
2. Cada consulta al vendedor que corresponde, con la charla resumida.
3. Un CRM que se completa solo con las conversaciones de WhatsApp y mail.
4. Números para decidir: embudo de compras, alquileres y tasaciones.
5. Informes automáticos para los propietarios, con recomendación de precio.

¿Lo vemos juntos en 15 minutos? Respondé este mail o agendá una llamada: https://dilvert.xyz/reservar

Santi Mallo Zander
Dilvert · IA y CRM para inmobiliarias · dilvert.xyz`;

export const DEFAULT_ASSETS_URL = "https://dilvert.xyz";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderDesignEmail(vars: {
  nombre: string;
  ciudad: string;
  unsubscribeUrl: string | null;
  assetsUrl?: string;
}) {
  let html = DESIGN_HTML;
  if (!vars.unsubscribeUrl) html = html.replace(/<!--baja-->[\s\S]*?<!--\/baja-->/, "");
  html = html
    .replace(/\{\{\s*nombre\s*\}\}/g, escapeHtml(vars.nombre))
    .replace(/\{\{\s*ciudad\s*\}\}/g, escapeHtml(vars.ciudad))
    .replace(/\{\{\s*baja\s*\}\}/g, escapeHtml(vars.unsubscribeUrl ?? ""))
    .replace(/\{\{\s*assets\s*\}\}/g, vars.assetsUrl ?? DEFAULT_ASSETS_URL);
  const text = DESIGN_TEXT.replace(/\{\{\s*nombre\s*\}\}/g, vars.nombre).replace(/\{\{\s*ciudad\s*\}\}/g, vars.ciudad);
  return { html, text };
}
