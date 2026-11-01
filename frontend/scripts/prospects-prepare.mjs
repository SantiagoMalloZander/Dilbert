#!/usr/bin/env node
// Prepara la lista de envío a partir de los CSV del scraper.
//
// Uso (desde frontend/): npm run prospects:preparar
//
// 1. Une todos los CSV de scraper-output/ (misma ficha de Maps = misma inmobiliaria).
// 2. Carga en Supabase las que falten y completa emails vacíos de las que ya estaban.
// 3. Deja un solo envío por email y por empresa (misma web en la misma localidad): el resto
//    queda "Descartado" con una nota.
// 4. Descarta emails cuyo dominio no recibe correo (sin MX) para evitar rebotes.
// 5. Exporta scraper-output/lista-envio-AAAA-MM-DD.csv con lo que se va a mandar.
// Se puede correr las veces que haga falta: no pisa estados ni ediciones.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolveMx } from "node:dns/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rankEmails } from "../src/lib/prospecting/enrich.ts";

const PROD_PROJECT_REF = "jyvadsrxbtomeyaidwuz"; // Supabase "Dilbert SP"
const OUTPUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scraper-output");
// Hosts compartidos por muchas empresas: no sirven para detectar "misma empresa"
const SHARED_HOSTS = /(remax|century21|kw|kellerwilliams|facebook|instagram|wixsite|wix|google|business\.site|linktr|blogspot|wordpress|mercadolibre|zonaprop|argenprop|tokkobroker|wasi|kiteprop|whatsapp|wa\.me)\./i;

// ---------------- CSV ----------------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (char !== "\r") field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...data] = rows;
  return data.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

function toCsv(rows, cols) {
  const esc = (v) => `"${String(Array.isArray(v) ? v.join(" ") : v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function placeIdFromUrl(url) {
  return url.match(/!19s(ChIJ[^!?&]+)/)?.[1] ?? url.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/)?.[1] ?? null;
}

function loadScrapedRows() {
  const files = readdirSync(OUTPUT_DIR).filter((f) => /^inmobiliarias-.*\.csv$/.test(f)).sort();
  const byId = new Map();
  let total = 0;
  for (const file of files) {
    const rows = parseCsv(readFileSync(path.join(OUTPUT_DIR, file), "utf8").replace(/^﻿/, ""));
    total += rows.length;
    for (const row of rows) {
      const placeId = placeIdFromUrl(row.mapsUrl ?? "");
      if (!placeId) continue;
      const externalId = `google:${placeId}`;
      const current = byId.get(externalId) ?? { externalId, emails: [] };
      // Los archivos van en orden: el más nuevo pisa, pero nunca con vacío
      for (const key of ["name", "town", "region", "address", "phone", "website", "mapsUrl"]) {
        if (row[key]) current[key] = row[key];
      }
      const emails = (row.emails || row.email || "").split(/\s+/).filter(Boolean).map((e) => e.toLowerCase());
      current.emails = [...new Set([...current.emails, ...emails])];
      current.email = current.email || row.email?.toLowerCase() || current.emails[0] || "";
      byId.set(externalId, current);
    }
  }
  return { files, total, rows: [...byId.values()] };
}

// ---------------- Supabase ----------------

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

  async function call(pathAndQuery, init = {}) {
    const response = await fetch(`${base}/${pathAndQuery}`, { ...init, headers: { ...headers, ...init.headers } });
    if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  return {
    listProspects: () => call("prospects?select=*&order=created_at.asc&limit=10000"),
    insert: (rows) =>
      call("prospects?on_conflict=external_id", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify(rows),
      }),
    update: (id, patch) =>
      call(`prospects?id=eq.${id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
      }),
  };
}

// ---------------- helpers ----------------

function companyDomain(website) {
  if (!website) return null;
  try {
    const host = new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, "");
    return SHARED_HOSTS.test(`${host}.`) ? null : host;
  } catch {
    return null;
  }
}

const mxCache = new Map();
async function domainReceivesMail(email) {
  const domain = email.split("@")[1];
  if (!domain) return false;
  if (!mxCache.has(domain)) {
    mxCache.set(
      domain,
      resolveMx(domain)
        .then((records) => records.length > 0)
        .catch((error) => (error.code === "ENOTFOUND" || error.code === "ENODATA" ? false : true))
    );
  }
  return mxCache.get(domain);
}

// ---------------- main ----------------

async function main() {
  const { files, total, rows } = loadScrapedRows();
  console.log(`CSV: ${files.length} archivos, ${total} filas → ${rows.length} inmobiliarias distintas`);

  const db = getSupabase();
  let existing = await db.listProspects();
  const byExternal = new Map(existing.map((p) => [p.external_id, p]));

  // 1) cargar las que faltan
  const missing = rows.filter((r) => !byExternal.has(r.externalId));
  let inserted = 0;
  for (let i = 0; i < missing.length; i += 200) {
    const batch = missing.slice(i, i + 200).map((r) => ({
      external_id: r.externalId,
      source: "google",
      name: r.name,
      town: r.town || null,
      region: r.region || null,
      address: r.address || null,
      phone: r.phone || null,
      website: r.website || null,
      maps_url: r.mapsUrl || null,
      email: r.email || null,
      emails: r.emails,
      enriched_at: r.website ? new Date().toISOString() : null,
    }));
    inserted += (await db.insert(batch)).length;
  }

  // 2) completar emails/teléfonos vacíos de las que ya estaban (sin pisar ediciones)
  let completed = 0;
  for (const row of rows) {
    const prospect = byExternal.get(row.externalId);
    if (!prospect || prospect.status !== "new") continue;
    const patch = {};
    const mergedEmails = [...new Set([...(prospect.emails ?? []), ...row.emails])];
    if (mergedEmails.length !== (prospect.emails ?? []).length) patch.emails = mergedEmails;
    if (!prospect.email && (row.email || mergedEmails[0])) patch.email = row.email || mergedEmails[0];
    // Re-elegir el mejor email si el actual lo eligió el scraper (no si lo editaste a mano)
    const current = patch.email ?? prospect.email;
    if (current && mergedEmails.includes(current) && prospect.website) {
      try {
        const host = new URL(prospect.website.startsWith("http") ? prospect.website : `https://${prospect.website}`).hostname;
        const best = rankEmails(mergedEmails.map((e) => e.replace(/\.com\.ar\.com$/, ".com.ar")), host)[0];
        if (best && best !== prospect.email) patch.email = best;
      } catch {
        // web inválida: dejamos el email como está
      }
    }
    if (!prospect.phone && row.phone) patch.phone = row.phone;
    if (Object.keys(patch).length) {
      await db.update(prospect.id, patch);
      completed += 1;
    }
  }
  console.log(`Base: ${inserted} cargadas nuevas, ${completed} completadas con datos que faltaban`);

  // 3) dedup por email y por empresa, y 4) validar dominio del email
  existing = await db.listProspects();
  const contactedEmails = new Set(existing.filter((p) => p.status !== "new" && p.email).map((p) => p.email.toLowerCase()));
  // Misma web en la misma localidad = misma empresa (fichas repetidas en Maps).
  // Entre localidades distintas son sucursales distintas y sí se les escribe.
  const companyKey = (p) => {
    const domain = companyDomain(p.website);
    return domain ? `${p.town ?? ""}|${domain}` : null;
  };
  const contactedDomains = new Set(existing.filter((p) => p.status !== "new").map(companyKey).filter(Boolean));
  const keptEmails = new Map();
  const keptDomains = new Map();
  const discards = [];

  for (const prospect of existing) {
    if (prospect.status !== "new" || !prospect.email) continue;
    const email = prospect.email.toLowerCase();
    const domain = companyKey(prospect);

    if (contactedEmails.has(email) || keptEmails.has(email)) {
      discards.push([prospect, `Email duplicado (${keptEmails.get(email)?.name ?? "ya contactado"})`]);
      continue;
    }
    if (domain && (contactedDomains.has(domain) || keptDomains.has(domain))) {
      discards.push([prospect, `Misma empresa que ${keptDomains.get(domain)?.name ?? "otra ya contactada"} (${domain.split("|")[1]})`]);
      continue;
    }
    if (!(await domainReceivesMail(email))) {
      discards.push([prospect, `El dominio de ${email} no recibe mails`]);
      continue;
    }
    keptEmails.set(email, prospect);
    if (domain) keptDomains.set(domain, prospect);
  }

  for (const [prospect, reason] of discards) {
    await db.update(prospect.id, { status: "discarded", notes: reason });
  }
  if (discards.length) {
    console.log(`Descartadas ${discards.length}:`);
    for (const [prospect, reason] of discards) console.log(`  - ${prospect.name} (${prospect.town}): ${reason}`);
  }

  // 5) lista final
  const sendList = [...keptEmails.values()].sort((a, b) => (a.town ?? "").localeCompare(b.town ?? ""));
  const withoutEmail = existing.filter((p) => p.status === "new" && !p.email).length;
  const listPath = path.join(OUTPUT_DIR, `lista-envio-${new Date().toISOString().slice(0, 10)}.csv`);
  writeFileSync(
    listPath,
    `﻿${toCsv(sendList, ["name", "town", "region", "email", "phone", "website", "address"])}`
  );

  const byTown = {};
  for (const p of sendList) byTown[p.town] = (byTown[p.town] ?? 0) + 1;
  console.log(`\nLista de envío: ${sendList.length} inmobiliarias con email único`);
  console.log(Object.entries(byTown).map(([town, n]) => `  ${town}: ${n}`).join("\n"));
  console.log(`Sin email (no se les manda): ${withoutEmail}`);
  console.log(`CSV: ${listPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
