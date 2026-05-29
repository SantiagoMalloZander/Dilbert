/**
 * Data Extractor — structured CRM data from raw channel text
 *
 * Single function extractStructuredData() that sends raw text (WhatsApp message,
 * email thread, or Fathom meeting transcript) to GPT-4o-mini and returns a fully
 * typed object with everything the CRM writer needs to populate the database.
 */

const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";

// ─── Input types ──────────────────────────────────────────────────────────────

export type DataSource = "whatsapp" | "gmail" | "fathom" | "audio";

export interface ExtractorContext {
  /** Contact history across all channels — output of getContactContext() */
  contactHistory?: string;
  /** Vendor's name for context */
  vendorName?: string;
  /** Known contact name if already resolved */
  knownContactName?: string;
  /** Known company name if already resolved */
  knownCompanyName?: string;
  /** Existing open deals for this contact (to help decide new vs existing) */
  openDeals?: Array<{ id: string; title: string; value: number | null; stage?: string | null }>;
  /** Accumulated agent memory: learned preferences + answered questions */
  agentMemory?: string;
  /** Company-level business context set by the owner (what the company sells, who to ignore, etc.) */
  companyContext?: string;
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface ContactInfo {
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  position: string | null;
  phone: string | null;
  email: string | null;
  linkedin_url: string | null;
  industry: string | null;
  website: string | null;
  address: string | null;
  annual_revenue: number | null;
  employee_count: number | null;
  notes: string | null;
}

export type StageKeyword =
  | "nuevo"
  | "en_contacto"
  | "calificado"
  | "visita_agendada"
  | "propuesta"
  | "negociacion"
  | "ganado"
  | "perdido"
  | null;

export interface DealInfo {
  title: string | null;
  /** Estimated value in the currency mentioned (NOT converted) */
  value: number | null;
  /** ISO 4217 code of the value: "ARS", "USD", "EUR"… null if no amount/currency mentioned */
  currency: string | null;
  /** 0-100 */
  probability: number | null;
  /** YYYY-MM-DD */
  expected_close_date: string | null;
  /** Specific product or service being discussed */
  product_or_service: string | null;
  /** Which existing deal_id this belongs to, if detectable */
  existing_deal_id: string | null;
  /**
   * Stage keyword inferred from the email content.
   * Used to advance the pipeline stage automatically.
   * "ganado"/"perdido" also trigger status change on the lead.
   */
  suggested_stage_keyword: StageKeyword;
  /** true when the client explicitly confirms the purchase / signs / gives final OK */
  mark_as_won: boolean;
  /** true when the client explicitly declines, cancels or says they won't continue */
  mark_as_lost: boolean;
}

export type Sentiment = "positive" | "neutral" | "negative";
export type DealStatus = "new" | "existing" | "unclear";
export type ConfidenceLevel = "high" | "medium" | "low";

/** Vertical-specific extraction profile. Selects the domain prompt + schema. */
export type ExtractionProfile = "generic" | "real_estate";

/**
 * Real-estate-specific structured data. Populated only by the "real_estate" profile.
 * The budget feeds deal_info.value/currency; the full object lands on first-class
 * lead columns via the crm-writer.
 */
export interface RealEstateInfo {
  /** Tipo de operación: compra | venta | alquiler | tasacion */
  operation_type: string | null;
  /** Rol del cliente: buyer | seller | owner | renter | investor */
  client_role: string | null;
  /** Tipo de propiedad: depto | casa | ph | terreno | local | oficina | cochera | galpon | quinta */
  property_type: string | null;
  /** Zona/barrio mencionado */
  zone: string | null;
  city: string | null;
  province: string | null;
  /** Presupuesto: monto mínimo del rango */
  budget_min: number | null;
  /** Presupuesto: monto máximo del rango (o el monto único si no hay rango) */
  budget_max: number | null;
  budget_currency: string | null;
  /** Ambientes (incluye living/comedor) */
  rooms: number | null;
  /** Dormitorios */
  bedrooms: number | null;
  bathrooms: number | null;
  /** Superficie total en m² */
  surface_total: number | null;
  /** Superficie cubierta en m² */
  surface_covered: number | null;
  has_garage: boolean | null;
  /** Urgencia: high | medium | low */
  urgency: string | null;
  /** Plazo o momento de compra: "este mes", "antes de fin de año"… */
  timeline: string | null;
  /** Referencia a un listing externo (url o id) */
  listing_ref: string | null;
  /** Estado de la visita: agendada | realizada | cancelada */
  visit_status: string | null;
  /** Forma de pago: contado | credito | mixto */
  financing: string | null;
}

export interface ExtractedData {
  contact_info: ContactInfo;
  deal_info: DealInfo;
  /** Real-estate fields — only populated by the "real_estate" profile, else null. */
  real_estate: RealEstateInfo | null;
  /** Main topics discussed, e.g. ["pricing", "demo", "delivery timeline"] */
  topics: string[];
  sentiment: Sentiment;
  action_items: string[];
  has_purchase_intent: boolean;
  /**
   * Whether this interaction deserves a CRM entry at all.
   * false = newsletter, automated notification, irrelevant service email, internal.
   * true  = real person with commercial or sales relevance.
   */
  is_relevant_for_crm: boolean;
  /** Whether this is a new deal or continuation of an existing one */
  deal_is_new_or_existing: DealStatus;
  confidence_level: ConfidenceLevel;
  /** One-line CRM note summarising the interaction */
  crm_note: string;
}

// ─── Null/empty result ────────────────────────────────────────────────────────

function emptyResult(): ExtractedData {
  return {
    contact_info: {
      first_name: null, last_name: null, company_name: null, position: null,
      phone: null, email: null, linkedin_url: null, industry: null,
      website: null, address: null, annual_revenue: null, employee_count: null,
      notes: null,
    },
    deal_info: {
      title: null, value: null, currency: null, probability: null, expected_close_date: null,
      product_or_service: null, existing_deal_id: null,
      suggested_stage_keyword: null, mark_as_won: false, mark_as_lost: false,
    },
    real_estate: null,
    topics: [],
    sentiment: "neutral",
    action_items: [],
    has_purchase_intent: false,
    is_relevant_for_crm: false,
    deal_is_new_or_existing: "unclear",
    confidence_level: "low",
    crm_note: "",
  };
}

// ─── Source-specific instructions ────────────────────────────────────────────

const SOURCE_HINTS: Record<DataSource, string> = {
  whatsapp:
    "El texto es una conversación de WhatsApp. Los mensajes son cortos e informales. " +
    "Prestá atención a menciones de productos, precios, fechas de entrega y señales de interés o rechazo.",
  gmail:
    "El texto es un email comercial. IMPORTANTE: " +
    "La línea 'De:' contiene el email/nombre del CLIENTE (es el contacto — ponelo en contact_info.email y extraé su nombre). " +
    "La línea 'Para:' contiene el email del VENDEDOR — ignoralo para datos del contacto. " +
    "Los marcadores <!-- gmail:... --> son IDs internos del sistema, ignóralos completamente. " +
    "Buscá: intención de compra, productos/servicios mencionados, cantidades, precios, señales de interés.",
  fathom:
    "El texto es una transcripción o resumen de una videollamada. " +
    "Puede haber varios participantes. Identificá quién es el cliente y quién es el vendedor. " +
    "Buscá compromisos, objeciones, precios mencionados y próximos pasos acordados.",
  audio:
    "El texto es la transcripción de una llamada telefónica o reunión presencial. " +
    "El vendedor puede estar narrando la conversación en tercera persona o puede ser una transcripción directa. " +
    "Extraé nombre, empresa, teléfono del contacto si se mencionan. " +
    "Buscá señales de interés, productos discutidos, precios y próximos pasos.",
};

// ─── Real-estate profile (vertical) ───────────────────────────────────────────

const REAL_ESTATE_DOMAIN =
  "DOMINIO: INMOBILIARIA. Estás procesando interacciones de una agencia inmobiliaria argentina. " +
  "El 'contacto' es el cliente (comprador, vendedor, propietario, inquilino o inversor). " +
  "El 'deal' es una BÚSQUEDA o un INTERÉS por una propiedad. " +
  "Un mismo cliente puede tener varias búsquedas distintas (cada una es un deal aparte). " +
  "Términos clave (español rioplatense): " +
  "operación (compra, venta, alquiler, tasación), tipo de propiedad (depto, casa, PH, terreno, local, oficina, cochera, galpón, quinta), " +
  "ambientes (incluye living/comedor) vs dormitorios (solo cuartos), m² totales vs cubiertos, expensas, " +
  "barrio/zona, presupuesto (USD vs ARS — fijate qué moneda), urgencia, plazo, financiación (contado, crédito UVA, mixto), " +
  "visita agendada/realizada, llaves, escritura, hipoteca.";

const REAL_ESTATE_RULES =
  "\n- real_estate.operation_type: compra | venta | alquiler | tasacion. compra/alquiler = cliente busca; venta/tasacion = cliente ofrece la propiedad.\n" +
  "- real_estate.client_role: buyer (compra) | seller (vende propia) | owner (tiene + alquila) | renter (alquila) | investor.\n" +
  "- real_estate.property_type: normalizá a uno de: depto | casa | ph | terreno | local | oficina | cochera | galpon | quinta.\n" +
  "- Para inmobiliaria, deal_info.value = real_estate.budget_max (el techo del presupuesto), deal_info.currency = real_estate.budget_currency.\n" +
  "- deal_info.title: armalo como \"{Operación} {Tipo} {Zona}\" (ej. \"Compra Depto Palermo\"). Si falta info, lo que tengas.\n" +
  "- Moneda en AR: \"dólares\", \"verdes\", \"USD\", \"U$D\", \"u$s\" → \"USD\". \"pesos\", \"$ AR\" o solo \"$\" → \"ARS\". Default si hay monto sin aclarar: ARS.\n" +
  "- rooms = ambientes (incluye living). Si dicen \"3 ambientes\", rooms=3. bedrooms = dormitorios solos.\n" +
  "- urgency: \"high\" si dice \"urgente\", \"ya\", \"esta semana\"; \"low\" si \"sin apuro\", \"para más adelante\"; resto \"medium\".\n" +
  "- visit_status: agendada (acordaron día), realizada (ya fueron), cancelada. null si no se menciona visita.\n" +
  "- Si el cliente menciona varias búsquedas claramente distintas, marcá deal_is_new_or_existing=\"new\" para la NUEVA y dejá la otra a la siguiente extracción.";

const REAL_ESTATE_SCHEMA = `,
  "real_estate": {
    "operation_type": "compra" | "venta" | "alquiler" | "tasacion" | null,
    "client_role": "buyer" | "seller" | "owner" | "renter" | "investor" | null,
    "property_type": "depto" | "casa" | "ph" | "terreno" | "local" | "oficina" | "cochera" | "galpon" | "quinta" | null,
    "zone": string | null,
    "city": string | null,
    "province": string | null,
    "budget_min": number | null,
    "budget_max": number | null,
    "budget_currency": "ARS" | "USD" | null,
    "rooms": number | null,
    "bedrooms": number | null,
    "bathrooms": number | null,
    "surface_total": number | null,
    "surface_covered": number | null,
    "has_garage": boolean | null,
    "urgency": "high" | "medium" | "low" | null,
    "timeline": string | null,
    "listing_ref": string | null,
    "visit_status": "agendada" | "realizada" | "cancelada" | null,
    "financing": "contado" | "credito" | "mixto" | null
  }`;

// ─── Main extractor ───────────────────────────────────────────────────────────

export async function extractStructuredData(
  text: string,
  source: DataSource,
  context: ExtractorContext = {},
  profile: ExtractionProfile = "generic"
): Promise<ExtractedData> {
  if (!OPENAI_KEY || !text.trim()) return emptyResult();

  const {
    contactHistory,
    vendorName,
    knownContactName,
    knownCompanyName,
    openDeals,
    agentMemory,
    companyContext,
  } = context;

  // Build the open deals list for the prompt
  const dealsContext = openDeals?.length
    ? `\nDeals abiertos actuales de este contacto:\n${openDeals
        .map((d) => `• [${d.id}] "${d.title}"${d.value != null ? ` — $${d.value}` : ""}${d.stage ? ` (etapa actual: ${d.stage})` : ""}`)
        .join("\n")}`
    : "";

  const systemPrompt = `Sos un agente de CRM de precisión. Tu única función es extraer datos estructurados de interacciones comerciales para cargarlos en el CRM. No respondés, no opinás — solo extraés.

${companyContext ? `CONTEXTO DEL NEGOCIO (leé esto primero — define qué interacciones son relevantes y cuáles ignorar):\n${companyContext}\n` : ""}${profile === "real_estate" ? REAL_ESTATE_DOMAIN + "\n\n" : ""}${SOURCE_HINTS[source]}

${vendorName ? `El vendedor se llama: ${vendorName}.` : ""}
${knownContactName ? `El contacto ya identificado es: ${knownContactName}.` : ""}
${knownCompanyName ? `La empresa del contacto ya identificada es: ${knownCompanyName}.` : ""}
${dealsContext}
${agentMemory ? `\nMemoria del agente (reglas aprendidas del vendedor):\n${agentMemory}` : ""}

Reglas estrictas:
- Si un dato no está en el texto, usá null. Nunca inventes.
- value: el monto tal como se menciona, SIN convertir de moneda. Si dicen "5 millones de pesos", value=5000000.
- currency: código ISO de la moneda del monto ("ARS", "USD", "EUR", "BRL"…). Si hay monto pero no se aclara la moneda, asumí "ARS" (negocio argentino). Si no hay monto, null.
- Fechas siempre en formato YYYY-MM-DD.
- confidence_level: "high" si el texto es claro y explícito, "medium" si hay inferencia razonable, "low" si el texto es ambiguo o muy corto.
- deal_is_new_or_existing: "existing" si se menciona algo ya discutido antes (usá el historial y los deals abiertos), "new" si es un producto/tema distinto, "unclear" si no se puede determinar.
- existing_deal_id: solo si podés matchear con certeza uno de los deals abiertos listados arriba.
- has_purchase_intent: true solo si hay señales claras (pidió precio, preguntó por disponibilidad, quiere avanzar, confirmó compra, etc.).
- suggested_stage_keyword: etapa del pipeline que mejor refleja este email. Valores posibles:
    "nuevo"           → sin señal suficiente para calificar, primer acercamiento sin intención clara
    "en_contacto"     → primer contacto real, respuesta de interés general, pidió más info
    "calificado"      → (real estate) presupuesto y zona confirmados, cliente busca opciones puntuales
    "visita_agendada" → (real estate) acordaron día/horario para visitar la propiedad
    "propuesta"       → (genérico) cliente pide cotización, presupuesto, propuesta formal, quiere ver números
    "negociacion"     → negocia precio/términos/condiciones, dice "queremos avanzar", pide cambios al contrato
    "ganado"          → confirma la compra, firma, acepta la propuesta, da OK final explícito
    "perdido"         → declina, cancela, dice que no va a seguir, elige otro proveedor
    null              → el email no está relacionado con ningún deal (irrelevante, interno, automático)
  Importante: solo avanzar stages, nunca retroceder. Si el deal ya está en "negociacion" y el email es genérico, poné null.
- mark_as_won: true SOLO si el cliente confirma explícitamente la compra o cierre (firma, "acepto", "vamos", "trato hecho"). No true si solo "suena positivo".
- mark_as_lost: true SOLO si el cliente rechaza o cancela explícitamente ("no gracias", "decidimos ir con otro", "cancelamos").
- is_relevant_for_crm: CRÍTICO. Poné false si el email es: newsletter, notificación automática, alerta de servicio, email de plataforma (Twitch, GitHub, Render, Stripe, etc.), no-reply, email interno del equipo, confirmación de pago/envío, email de proveedor de servicios técnicos, o cualquier cosa que el contexto del negocio indique ignorar. Poné true SOLO si es una persona real con interés comercial real en los productos/servicios de la empresa.${profile === "real_estate" ? REAL_ESTATE_RULES : ""}

Devolvé ÚNICAMENTE el siguiente JSON sin texto adicional:
{
  "contact_info": {
    "first_name": string | null,
    "last_name": string | null,
    "company_name": string | null,
    "position": string | null,
    "phone": string | null,
    "email": string | null,
    "linkedin_url": string | null,
    "industry": string | null,
    "website": string | null,
    "address": string | null,
    "annual_revenue": number | null,
    "employee_count": number | null,
    "notes": string | null
  },
  "deal_info": {
    "title": string | null,
    "value": number | null,
    "currency": string | null,
    "probability": number | null,
    "expected_close_date": string | null,
    "product_or_service": string | null,
    "existing_deal_id": string | null,
    "suggested_stage_keyword": "nuevo" | "en_contacto" | "calificado" | "visita_agendada" | "propuesta" | "negociacion" | "ganado" | "perdido" | null,
    "mark_as_won": boolean,
    "mark_as_lost": boolean
  },
  "topics": string[],
  "sentiment": "positive" | "neutral" | "negative",
  "action_items": string[],
  "has_purchase_intent": boolean,
  "is_relevant_for_crm": boolean,
  "deal_is_new_or_existing": "new" | "existing" | "unclear",
  "confidence_level": "high" | "medium" | "low",
  "crm_note": string${profile === "real_estate" ? REAL_ESTATE_SCHEMA : ""}
}`;

  const userContent = [
    contactHistory ? `${contactHistory}\n\n---` : null,
    `Interacción a analizar (${source}):\n${text.slice(0, 9000)}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1000,
        temperature: 0,          // deterministic — we want facts, not creativity
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[data-extractor] OpenAI error", res.status, await res.text());
      return emptyResult();
    }

    const raw = await res.json() as { choices: Array<{ message: { content: string } }> };
    const content = raw.choices?.[0]?.message?.content;
    if (!content) return emptyResult();

    const parsed = JSON.parse(content) as ExtractedData;

    // Sanitise — make sure required arrays exist
    parsed.topics = Array.isArray(parsed.topics) ? parsed.topics : [];
    parsed.action_items = Array.isArray(parsed.action_items) ? parsed.action_items : [];
    // real_estate present only for the real-estate profile; default to null otherwise
    parsed.real_estate =
      parsed.real_estate && typeof parsed.real_estate === "object" ? parsed.real_estate : null;

    return parsed;
  } catch (err) {
    console.error("[data-extractor] parse error", err);
    return emptyResult();
  }
}

// ─── Helper: check if extraction has any useful data ─────────────────────────

export function hasUsefulData(data: ExtractedData): boolean {
  const c = data.contact_info;
  const d = data.deal_info;
  return !!(
    c.first_name || c.company_name || c.email || c.phone ||
    d.title || d.value || data.topics.length || data.action_items.length
  );
}
