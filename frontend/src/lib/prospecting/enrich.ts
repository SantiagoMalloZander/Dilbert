// Busca emails de contacto en la web de una inmobiliaria: home + hasta 2
// páginas de contacto. Sin dependencias: fetch + regex.

const EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const CONTACT_LINK_REGEX = /href=["']([^"'#]*(?:contact|contacto|nosotros|about|quienes)[^"'#]*)["']/gi;
const PAGE_TIMEOUT_MS = 6000;
const MAX_HTML_BYTES = 600_000;

// Redes sociales y portales: no son la web de la inmobiliaria.
const NON_CRAWLABLE_HOSTS = [
  "facebook.com",
  "instagram.com",
  "wa.me",
  "whatsapp.com",
  "linktr.ee",
  "zonaprop.com.ar",
  "argenprop.com",
  "mercadolibre.com.ar",
  "google.com",
];

const JUNK_EMAIL_PATTERNS = [
  /\.(png|jpe?g|gif|webp|svg|css|js)$/i,
  /@(example|sentry|wixpress|sentry-next|domain|email|tudominio|yourdomain)\./i,
  /^(no-?reply|noreply|donotreply|postmaster|webmaster|abuse)@/i,
  /@\d+x\./i,
  /@(correo|mail|email)\.com(\.ar)?$/i, // placeholders tipo mi@correo.com.ar
  /^(tu|mi|su|nombre)(email|mail|correo)?@/i,
  /u00[0-9a-f]{2}/i,
];

function isJunkEmail(email: string) {
  return JUNK_EMAIL_PATTERNS.some((pattern) => pattern.test(email));
}

export function normalizeWebsite(website: string | null | undefined) {
  if (!website) return null;
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`);
    const host = url.hostname.replace(/^www\./, "");
    if (NON_CRAWLABLE_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

async function fetchHtml(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) return null;
    const html = await response.text();
    return html.slice(0, MAX_HTML_BYTES);
  } catch {
    return null;
  }
}

function extractEmails(html: string) {
  // Algunos sitios ofuscan con [at] / (arroba)
  const decoded = html
    .replace(/&#64;|&commat;/gi, "@")
    .replace(/\s*\[(?:at|arroba)\]\s*|\s*\((?:at|arroba)\)\s*/gi, "@")
    .replace(/%40/g, "@");

  const found = new Set<string>();
  for (const match of decoded.matchAll(EMAIL_REGEX)) {
    const email = match[0]
      .toLowerCase()
      .replace(/^mailto:/, "")
      .replace(/\.+$/, "")
      .replace(/\.com\.ar\.com$/, ".com.ar"); // typo frecuente en las webs
    if (!isJunkEmail(email)) found.add(email);
  }
  return [...found];
}

function extractContactLinks(html: string, base: URL) {
  const links = new Set<string>();
  for (const match of html.matchAll(CONTACT_LINK_REGEX)) {
    try {
      const url = new URL(match[1], base);
      if (url.hostname === base.hostname) links.add(url.toString());
    } catch {
      // link roto
    }
  }
  return [...links].slice(0, 2);
}

const WEBMAIL = /@(gmail|hotmail|yahoo|outlook|live|icloud|telpin|fibertel|speedy|arnet|uolsinectis|ciudad)\./;

/** True si comparten un pedazo de 5+ letras (ej. "andaresinmobiliaria" y "andarespinamar"). */
function sharesChunk(a: string, b: string) {
  for (let i = 0; i + 5 <= a.length; i += 1) {
    if (b.includes(a.slice(i, i + 5))) return true;
  }
  return false;
}

/**
 * Ordena para que el primero sea el mejor candidato a "email principal".
 * Ojo con los emails de otras empresas que aparecen en la web (el diseñador
 * del sitio, la inmobiliaria de al lado): esos van al final.
 */
export function rankEmails(emails: string[], host: string) {
  const domain = host.replace(/^www\./, "");
  const siteLabel = domain.split(".")[0].replace(/[^a-z0-9]/g, "");
  const score = (email: string) => {
    const [local, emailDomain] = email.split("@");
    let value = 0;
    if (emailDomain === domain || domain.endsWith(`.${emailDomain}`)) value += 10;
    else if (WEBMAIL.test(email)) value += 2;
    else value -= 6; // dominio de otra empresa
    if (sharesChunk(local.replace(/[^a-z0-9]/g, ""), siteLabel)) value += 8;
    if (/^(info|contacto|ventas|consultas|administracion|hola)@/.test(email)) value += 3;
    return value;
  };
  return [...emails].sort((a, b) => score(b) - score(a));
}

export async function findEmailsOnWebsite(website: string | null | undefined) {
  const base = normalizeWebsite(website);
  if (!base) return [];

  const home = await fetchHtml(base.toString());
  if (!home) return [];

  const emails = new Set(extractEmails(home));

  if (emails.size === 0) {
    const pages = await Promise.all(extractContactLinks(home, base).map(fetchHtml));
    for (const html of pages) {
      if (html) extractEmails(html).forEach((email) => emails.add(email));
    }
  }

  return rankEmails([...emails], base.hostname).slice(0, 10);
}
