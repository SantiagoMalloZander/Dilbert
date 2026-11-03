#!/usr/bin/env node
// Envía la campaña de prospección (diseño Dilvert) a las inmobiliarias "Nuevo"
// con email de las localidades elegidas, de a una con pausa.
//
// Uso (desde frontend/), con la key de Resend por stdin:
//   netlify env:get RESEND_API_KEY | npm run campaign -- Pinamar Cariló
// Opciones: --pausa 30 (segundos promedio entre mails), --limite 50, --prueba (no manda, solo lista)
//
// Cada envío queda en prospect_emails y el prospecto pasa a "Enviado".
// Nunca manda dos veces a la misma dirección.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { renderDesignEmail } from "../src/lib/prospecting/email-design.ts";
import { DEFAULT_SUBJECT, renderTemplate } from "../src/lib/prospecting/template.ts";

const require = createRequire(import.meta.url);
const { Resend } = require("resend");

const PROD_PROJECT_REF = "jyvadsrxbtomeyaidwuz";
const FROM_ADDRESS = "onboarding@dilbert.galto.online"; // dominio verificado en Resend
const FROM_NAME = "Santi de Dilvert";
const REPLY_TO = "mallozandersantiago@gmail.com";
const APP_URL = "https://dilvert.xyz";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(argv) {
  const opts = { towns: [], pause: 30, limit: Infinity, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--pausa") opts.pause = Number(argv[++i]);
    else if (argv[i] === "--limite") opts.limit = Number(argv[++i]);
    else if (argv[i] === "--prueba") opts.dryRun = true;
    else opts.towns.push(argv[i]);
  }
  return opts;
}

function getSupabase() {
  const keys = JSON.parse(
    execFileSync("supabase", ["projects", "api-keys", "--project-ref", PROD_PROJECT_REF, "-o", "json"], {
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 30000,
    }).toString()
  );
  const key = keys.find((k) => k.name === "service_role")?.api_key;
  const base = `https://${PROD_PROJECT_REF}.supabase.co/rest/v1`;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  return async (pathAndQuery, init = {}) => {
    const response = await fetch(`${base}/${pathAndQuery}`, { ...init, headers: { ...headers, ...init.headers } });
    if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.towns.length === 0) throw new Error("Indicá al menos una localidad. Ej: npm run campaign -- Pinamar");

  const db = getSupabase();
  const townFilter = opts.towns.map((t) => `"${t}"`).join(",");
  const recipients = await db(
    `prospects?select=*&status=eq.new&email=not.is.null&town=in.(${encodeURIComponent(townFilter)})&order=town.asc,name.asc`
  );
  const sent = await db("prospect_emails?select=to_email&status=eq.sent&limit=10000");
  const contacted = new Set(sent.map((row) => row.to_email.toLowerCase()));

  const queue = [];
  const seen = new Set();
  for (const prospect of recipients) {
    const email = prospect.email.toLowerCase();
    if (contacted.has(email) || seen.has(email)) continue;
    seen.add(email);
    queue.push(prospect);
  }
  const toSend = queue.slice(0, opts.limit);
  console.log(`${toSend.length} mails para mandar (${opts.towns.join(", ")})`);
  if (opts.dryRun) {
    toSend.forEach((p) => console.log(`  ${p.town} · ${p.name} <${p.email}>`));
    return;
  }

  const apiKey = readFileSync(0, "utf8").trim();
  if (!apiKey.startsWith("re_")) throw new Error("Pasá la key de Resend por stdin (netlify env:get RESEND_API_KEY | ...)");
  const resend = new Resend(apiKey);

  let ok = 0;
  let failed = 0;
  for (const [index, prospect] of toSend.entries()) {
    const vars = { nombre: prospect.name, ciudad: prospect.town || "tu zona" };
    const unsubscribeUrl = `${APP_URL}/api/baja?t=${prospect.unsubscribe_token}`;
    const { html, text } = renderDesignEmail({ ...vars, unsubscribeUrl });
    const subject = renderTemplate(DEFAULT_SUBJECT, vars);

    const { error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_ADDRESS}>`,
      to: [prospect.email],
      replyTo: REPLY_TO,
      subject,
      html,
      text: `${text}\n\n—\nSi no querés recibir más mails míos, date de baja acá: ${unsubscribeUrl}`,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    await db("prospect_emails", {
      method: "POST",
      body: JSON.stringify({
        prospect_id: prospect.id,
        to_email: prospect.email.toLowerCase(),
        subject,
        status: error ? "failed" : "sent",
        error: error ? JSON.stringify(error).slice(0, 500) : null,
      }),
    });

    if (error) {
      failed += 1;
      console.log(`  ✗ [${index + 1}/${toSend.length}] ${prospect.name} <${prospect.email}>: ${error.message ?? JSON.stringify(error)}`);
      // límite diario / key inválida: no tiene sentido seguir
      if (/daily|quota|limit|api key|validation_error/i.test(JSON.stringify(error))) break;
    } else {
      ok += 1;
      await db(`prospects?id=eq.${prospect.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "sent",
          send_count: (prospect.send_count ?? 0) + 1,
          last_contacted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
      console.log(`  ✓ [${index + 1}/${toSend.length}] ${prospect.town} · ${prospect.name} <${prospect.email}>`);
    }

    if (index < toSend.length - 1) await sleep(opts.pause * 1000 * (0.65 + Math.random() * 0.7));
  }

  console.log(`\nListo: ${ok} enviados, ${failed} fallidos.`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
