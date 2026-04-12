/**
 * Deal Detector — AI-powered deal disambiguation
 *
 * Determines whether a new topic belongs to an existing open deal
 * or should create a brand-new one. Three-layer decision:
 *
 *   1. Fast path: no open leads → create_new (no LLM needed)
 *   2. Fast path: token-overlap ≥ 0.65 with exactly one lead → update_existing
 *   3. Fast path: zero overlap with all leads → create_new
 *   4. Ambiguous → GPT-4o-mini decides
 *
 * Called by crm-writer when data-extractor returned deal_is_new_or_existing = "unclear".
 */

const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OpenLead {
  id: string;
  title: string;
  value: number | null;
  stage?: string | null;
}

export type DealAction = "update_existing" | "create_new" | "ask_vendor";

export interface DealDetectorOutput {
  action: DealAction;
  /** Populated when action = "update_existing" */
  lead_id?: string;
  confidence: "high" | "medium";
  /** Populated when action = "ask_vendor" */
  vendorQuestion?: string;
}

// ─── Token overlap (same as identity-resolver) ────────────────────────────────

function tokenScore(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const tb = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let hits = 0;
  for (const t of ta) if (tb.has(t)) hits++;
  return hits / Math.max(ta.size, tb.size);
}

// ─── Main detector ────────────────────────────────────────────────────────────

export async function detectDeal(
  topic: string,
  context: string,
  openLeads: OpenLead[]
): Promise<DealDetectorOutput> {
  // ── Fast path: nothing to compare against ───────────────────────────────────
  if (!openLeads.length) {
    return { action: "create_new", confidence: "high" };
  }

  // ── Score every lead ────────────────────────────────────────────────────────
  const scored = openLeads.map((lead) => ({
    lead,
    score: tokenScore(topic, lead.title),
  }));
  const best = scored.reduce((a, b) => (a.score > b.score ? a : b));

  // ── Fast path: strong match ─────────────────────────────────────────────────
  if (best.score >= 0.65) {
    return { action: "update_existing", lead_id: best.lead.id, confidence: "high" };
  }

  // ── Fast path: clearly unrelated ───────────────────────────────────────────
  if (best.score <= 0.1) {
    return { action: "create_new", confidence: "high" };
  }

  // ── GPT disambiguation ──────────────────────────────────────────────────────
  if (!OPENAI_KEY) {
    // No API key → conservative: create new to avoid overwriting wrong deal
    return { action: "create_new", confidence: "medium" };
  }

  const leadsText = openLeads
    .map((l, i) => `${i + 1}. [${l.id}] "${l.title}"${l.value != null ? ` ($${l.value})` : ""}${l.stage ? ` — etapa: ${l.stage}` : ""}`)
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
        max_tokens: 200,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Sos un asistente de CRM. Dado un tema nuevo de conversación y una lista de deals abiertos,
decidí si el tema pertenece a algún deal existente o es uno nuevo.

Devolvé SOLO este JSON:
{
  "action": "update_existing" | "create_new" | "ask_vendor",
  "lead_id": "el id del deal si action es update_existing, sino null",
  "confidence": "high" | "medium",
  "vendor_question": "pregunta para el vendedor si action es ask_vendor, sino null"
}

Reglas:
- update_existing: el tema claramente es continuación de un deal existente
- create_new: el tema es un producto/servicio/objetivo diferente
- ask_vendor: no podés determinar con certeza (solo usalo si es realmente ambiguo)`,
          },
          {
            role: "user",
            content: `Tema nuevo: "${topic}"\n\nContexto de la conversación: ${context.slice(0, 500)}\n\nDeals abiertos del contacto:\n${leadsText}`,
          },
        ],
      }),
    });

    if (!res.ok) return { action: "create_new", confidence: "medium" };

    const raw = await res.json() as { choices: Array<{ message: { content: string } }> };
    const parsed = JSON.parse(raw.choices?.[0]?.message?.content ?? "{}") as {
      action?: DealAction;
      lead_id?: string | null;
      confidence?: "high" | "medium";
      vendor_question?: string | null;
    };

    const action = parsed.action ?? "create_new";
    return {
      action,
      lead_id: parsed.lead_id ?? undefined,
      confidence: parsed.confidence ?? "medium",
      vendorQuestion: parsed.vendor_question ?? undefined,
    };
  } catch (err) {
    console.error("[deal-detector] GPT error", err);
    return { action: "create_new", confidence: "medium" };
  }
}
