#!/usr/bin/env node
// Scraper de inmobiliarias en Google Maps (navegador real, sin API ni costo).
//
// Uso (desde frontend/):
//   npm run scraper                         → te muestra la lista y elegís
//   npm run scraper -- Pinamar "Villa Gesell"
//   npm run scraper -- --region "Costa Atlántica"
//   npm run scraper -- --todas
// Opciones: --ver (muestra el navegador), --sin-emails (no rastrea webs),
//           --buscar "propiedades" (cambia la búsqueda; se puede repetir).
//
// Guarda siempre un CSV en frontend/scraper-output/ y, si existen las tablas
// de prospección, carga todo en Supabase (aparece en /app/admin/prospeccion).
// Corre en tu compu: Netlify no puede abrir un navegador.

import { createInterface } from "node:readline/promises";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import {
  PROSPECT_REGIONS,
  PROSPECT_TOWNS,
  distanceKm,
  isExcludedAddress,
  isInExcludedZone,
} from "../src/lib/prospecting/towns.ts";
import { findEmailsOnWebsite } from "../src/lib/prospecting/enrich.ts";

const PROD_PROJECT_REF = "jyvadsrxbtomeyaidwuz"; // Supabase "Dilbert SP"
const OUTPUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scraper-output");
const DEFAULT_QUERIES = ["inmobiliaria"];
const RELEVANT = /inmobiliari|propiedad|bienes ra[ií]ces|corredor|martiller|tasaci|real estate|negocios inmobiliarios/i;
const MAX_SCROLLS = 40;
const EMAIL_CONCURRENCY = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const humanPause = (min, max) => sleep(min + Math.random() * (max - min));

// ---------------- argumentos ----------------

function parseArgs(argv) {
  const opts = { towns: [], regions: [], all: false, headed: false, emails: true, queries: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--todas") opts.all = true;
    else if (arg === "--ver") opts.headed = true;
    else if (arg === "--sin-emails") opts.emails = false;
    else if (arg === "--region") opts.regions.push(argv[++i]);
    else if (arg === "--buscar") opts.queries.push(argv[++i]);
    else opts.towns.push(arg);
  }
  return opts;
}

const normalize = (text) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function matchTowns(names) {
  const selected = [];
  for (const name of names) {
    const key = normalize(name);
    // "Mar del Plata" selecciona todos sus barrios
    const matches = PROSPECT_TOWNS.filter((t) => normalize(t.name) === key || normalize(t.name).startsWith(`${key} ·`));
    if (matches.length === 0) console.warn(`⚠ No conozco la localidad "${name}" (ver lista con: npm run scraper)`);
    selected.push(...matches);
  }
  return selected;
}

async function askTowns() {
  console.log("\nLocalidades disponibles:\n");
  let n = 0;
  const indexed = [];
  PROSPECT_REGIONS.forEach((region, r) => {
    console.log(`  [${String.fromCharCode(65 + r)}] ${region}`);
    for (const town of PROSPECT_TOWNS.filter((t) => t.region === region)) {
      n += 1;
      indexed.push(town);
      console.log(`      ${String(n).padStart(2)}. ${town.name}`);
    }
  });
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    "\nElegí números y/o letras de región separados por coma (ej: 3,7,C) o 'todas': "
  );
  rl.close();
  if (answer.trim().toLowerCase() === "todas") return PROSPECT_TOWNS;

  const selected = [];
  for (const token of answer.split(",").map((t) => t.trim()).filter(Boolean)) {
    if (/^[a-z]$/i.test(token)) {
      const region = PROSPECT_REGIONS[token.toUpperCase().charCodeAt(0) - 65];
      selected.push(...PROSPECT_TOWNS.filter((t) => t.region === region));
    } else if (indexed[Number(token) - 1]) {
      selected.push(indexed[Number(token) - 1]);
    }
  }
  return selected;
}

// ---------------- Google Maps ----------------

function searchUrl(query, town) {
  const text = `${query} en ${town.searchAs ?? town.name}, Buenos Aires`;
  return `https://www.google.com/maps/search/${encodeURIComponent(text).replace(/%20/g, "+")}/@${town.lat},${town.lng},14z?hl=es`;
}

async function acceptConsentIfAsked(page) {
  if (!page.url().includes("consent.")) return;
  const button = page.locator('button:has-text("Aceptar todo"), button:has-text("Accept all")');
  if (await button.count()) {
    await button.first().click();
    await page.waitForLoadState("domcontentloaded");
  }
}

async function scrollFeedToEnd(page) {
  const feed = page.locator('div[role="feed"]');
  let lastCount = 0;
  let stable = 0;
  for (let i = 0; i < MAX_SCROLLS; i += 1) {
    await feed.evaluate((el) => el.scrollBy(0, el.scrollHeight));
    await humanPause(900, 1700);
    const count = await page.locator('div[role="feed"] a[href*="/maps/place/"]').count();
    const ended = await page.getByText(/Llegaste al final de la lista|You've reached the end of the list/).count();
    if (ended) break;
    stable = count === lastCount ? stable + 1 : 0;
    if (stable >= 3) break;
    lastCount = count;
  }
}

async function readCards(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('div[role="feed"] a[href*="/maps/place/"]')].map((anchor) => {
      const card = anchor.parentElement;
      const site = card.querySelector('a[data-value="Sitio web"], a[data-value="Website"]');
      return {
        name: anchor.getAttribute("aria-label") ?? "",
        href: anchor.href,
        text: card.innerText,
        website: site ? site.href : null,
      };
    })
  );
}

const PHONE_REGEX = /(?:\+54 ?9? ?)?\(?0?\d{2,4}\)?[ -]?(?:15[ -])?\d{2,4}[ -]\d{4}/;

function parseCard(card, town) {
  const placeId =
    card.href.match(/!19s(ChIJ[^!?&]+)/)?.[1] ?? card.href.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/)?.[1];
  const lat = Number(card.href.match(/!3d(-?\d+\.\d+)/)?.[1]);
  const lng = Number(card.href.match(/!4d(-?\d+\.\d+)/)?.[1]);
  if (!placeId || !card.name) return null;

  const lines = card.text.split("\n").map((l) => l.trim()).filter(Boolean);
  const detail = lines.find((l) => l.includes("·") && !/^(Abierto|Cerrado|Abre|Cierra)/.test(l)) ?? "";
  const [category = "", ...addressParts] = detail.split("·").map((part) => part.trim());
  const address = addressParts.join(" · ").replace(/^\W+/, "") || null;
  // El teléfono nunca está en la línea "rubro · dirección" (ahí hay números de calle)
  const phone =
    lines
      .filter((line) => line !== detail)
      .map((line) => line.match(PHONE_REGEX)?.[0]?.trim())
      .find(Boolean) ?? null;

  let website = card.website;
  if (website?.includes("google.com/url")) {
    website = new URL(website).searchParams.get("q") ?? website;
  }

  return {
    externalId: `google:${placeId}`,
    name: card.name,
    category,
    town: town.name,
    region: town.region,
    address,
    phone,
    website,
    mapsUrl: card.href.split("?")[0],
    lat,
    lng,
  };
}

function keep(prospect, town) {
  if (!RELEVANT.test(`${prospect.category} ${prospect.name}`)) return false;
  if (isExcludedAddress(prospect.address)) return false;
  if (Number.isFinite(prospect.lat) && Number.isFinite(prospect.lng)) {
    if (isInExcludedZone(prospect.lat, prospect.lng)) return false;
    const maxKm = (town.radiusKm ?? 6) + 6;
    if (distanceKm(town.lat, town.lng, prospect.lat, prospect.lng) > maxKm) return false;
  }
  return true;
}

// ---------------- Supabase ----------------

function getSupabase() {
  let url = process.env.SUPABASE_URL;
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    try {
      const keys = JSON.parse(
        execFileSync("supabase", ["projects", "api-keys", "--project-ref", PROD_PROJECT_REF, "-o", "json"], {
          stdio: ["ignore", "pipe", "ignore"],
          timeout: 30000,
        }).toString()
      );
      url = `https://${PROD_PROJECT_REF}.supabase.co`;
      key = keys.find((k) => k.name === "service_role")?.api_key;
    } catch {
      return null;
    }
  }
  if (!url || !key) return null;

  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  return {
    async tablesReady() {
      const response = await fetch(`${url}/rest/v1/prospects?select=id&limit=1`, { headers });
      return response.ok;
    },
    async insert(rows) {
      // ignore-duplicates: si ya existía (por external_id) no pisa estado ni email editado
      const response = await fetch(`${url}/rest/v1/prospects?on_conflict=external_id`, {
        method: "POST",
        headers: { ...headers, Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify(rows),
      });
      if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
      return response.json();
    },
  };
}

// ---------------- main ----------------

function toCsv(rows) {
  const cols = ["name", "category", "town", "region", "email", "emails", "phone", "website", "address", "mapsUrl"];
  const esc = (v) => `"${String(Array.isArray(v) ? v.join(" ") : v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

async function enrichEmails(rows) {
  const queue = rows.filter((r) => r.website);
  const total = queue.length;
  let done = 0;
  async function worker() {
    while (queue.length) {
      const row = queue.shift();
      row.emails = await findEmailsOnWebsite(row.website).catch(() => []);
      row.email = row.emails[0] ?? null;
      done += 1;
      process.stdout.write(`\r  Rastreando webs: ${done}/${total}   `);
    }
  }
  await Promise.all(Array.from({ length: EMAIL_CONCURRENCY }, worker));
  if (done) process.stdout.write("\n");
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let towns = opts.all
    ? PROSPECT_TOWNS
    : [...matchTowns(opts.towns), ...PROSPECT_TOWNS.filter((t) => opts.regions.includes(t.region))];
  if (towns.length === 0 && !opts.all) towns = await askTowns();
  towns = [...new Map(towns.map((t) => [t.name, t])).values()];
  if (towns.length === 0) {
    console.log("No elegiste ninguna localidad.");
    return;
  }

  const queries = opts.queries.length ? opts.queries : DEFAULT_QUERIES;
  console.log(`\nBuscando en ${towns.length} localidades: ${towns.map((t) => t.name).join(", ")}\n`);

  const browser = await chromium.launch({ headless: !opts.headed });
  const context = await browser.newContext({
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const found = new Map();
  for (const [index, town] of towns.entries()) {
    let townCount = 0;
    for (const query of queries) {
      try {
        await page.goto(searchUrl(query, town), { waitUntil: "domcontentloaded", timeout: 45000 });
        await acceptConsentIfAsked(page);
        const feed = await page.waitForSelector('div[role="feed"]', { timeout: 15000 }).catch(() => null);
        if (!feed) {
          if (/sorry|captcha/i.test(page.url())) {
            console.error("\n✗ Google pidió un captcha. Frená un rato o corré con --ver y resolvelo a mano.");
            break;
          }
          continue; // un solo resultado o ninguno
        }
        await scrollFeedToEnd(page);
        for (const card of await readCards(page)) {
          const prospect = parseCard(card, town);
          if (!prospect || found.has(prospect.externalId) || !keep(prospect, town)) continue;
          found.set(prospect.externalId, prospect);
          townCount += 1;
        }
      } catch (error) {
        console.error(`  ✗ ${town.name} (${query}): ${error.message.split("\n")[0]}`);
      }
      await humanPause(2500, 5000);
    }
    console.log(`  [${index + 1}/${towns.length}] ${town.name}: ${townCount} inmobiliarias`);
    if (index < towns.length - 1) await humanPause(3000, 7000);
  }
  await browser.close();

  const rows = [...found.values()].map((r) => ({ ...r, email: null, emails: [] }));
  console.log(`\nTotal: ${rows.length} inmobiliarias (${rows.filter((r) => r.website).length} con web)`);

  if (opts.emails && rows.length) await enrichEmails(rows);
  console.log(`Con email: ${rows.filter((r) => r.email).length}`);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const csvPath = path.join(OUTPUT_DIR, `inmobiliarias-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.csv`);
  writeFileSync(csvPath, `﻿${toCsv(rows)}`);
  console.log(`CSV: ${csvPath}`);

  const supabase = getSupabase();
  if (!supabase || !rows.length) return;
  if (!(await supabase.tablesReady())) {
    console.log("⚠ Las tablas de prospección no existen en Supabase todavía: quedó solo el CSV.");
    return;
  }
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200).map((r) => ({
      external_id: r.externalId,
      source: "google",
      name: r.name,
      town: r.town,
      region: r.region,
      address: r.address,
      phone: r.phone,
      website: r.website,
      maps_url: r.mapsUrl,
      email: r.email,
      emails: r.emails,
      enriched_at: opts.emails && r.website ? new Date().toISOString() : null,
    }));
    inserted += (await supabase.insert(batch)).length;
  }
  console.log(`Supabase: ${inserted} nuevas cargadas (las repetidas se ignoran). Miralas en /app/admin/prospeccion`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
