// Plantilla de la campaña de prospección (compartida entre server y panel).

export const DEFAULT_SUBJECT = "{{nombre}}: ¿cuántas consultas se les pierden por WhatsApp?";

export const DEFAULT_BODY = `Hola, equipo de {{nombre}}:

Les escribo porque trabajo con inmobiliarias de {{ciudad}} y la zona, y casi todas me cuentan lo mismo: las consultas llegan por WhatsApp, mail y portales, y muchas quedan sin seguimiento.

Armamos Dilvert, un CRM para inmobiliarias que lee las conversaciones de WhatsApp y mail de cada vendedor y carga solo cada consulta: qué busca el cliente, zona, presupuesto, visitas agendadas. El equipo no tiene que cargar nada a mano.

¿Les sirve que les muestre cómo funciona en una llamada de 15 minutos esta semana?

Saludos,
Santi
Dilvert — dilvert.xyz`;

export type TemplateVars = { nombre: string; ciudad: string };

export function renderTemplate(template: string, vars: TemplateVars) {
  return template
    .replace(/\{\{\s*nombre\s*\}\}/gi, vars.nombre)
    .replace(/\{\{\s*ciudad\s*\}\}/gi, vars.ciudad);
}
