/**
 * Agent Memory — persistent learning between sessions
 *
 * Three layers of memory:
 *
 * 1. Learned preferences — arbitrary key/value rules the vendor has taught the agent.
 *    Stored in channel_credentials (channel = "agent_memory") as JSONB per vendor.
 *    Example: { "deal_split_rule": "Producto X siempre es un deal separado." }
 *
 * 2. Resolved identities — already in contact_channel_links (identity-resolver handles this).
 *
 * 3. Answered questions — agent_questions with status "answered".
 *    Used for deduplication (don't ask the same thing twice) and injected into prompts
 *    so the AI knows what the vendor has already clarified.
 *
 * Main export: getAgentMemory(userId, companyId) → formatted context string for AI prompts.
 */

import { createAdminSupabaseClient } from "@/lib/supabase/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentMemoryContext {
  /** Formatted string ready to inject into AI system prompt */
  promptContext: string;
  /** Number of contacts the agent has resolved across channels */
  resolvedIdentitiesCount: number;
  /** Recently answered vendor questions (last 20) */
  recentAnswers: Array<{ question: string; answer: string; date: string }>;
  /** Vendor-taught rules/preferences */
  learnedPreferences: Record<string, string>;
}

interface MemoryStore {
  preferences: Record<string, string>;
  updatedAt?: string;
}

// ─── Token similarity (same approach as identity-resolver) ────────────────────

function tokenScore(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const tb = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let matches = 0;
  for (const t of ta) if (tb.has(t)) matches++;
  return matches / Math.max(ta.size, tb.size);
}

// ─── Preference store (channel_credentials row with channel="agent_memory") ───

async function loadMemoryStore(userId: string, companyId: string): Promise<MemoryStore> {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("channel_credentials")
    .select("credentials")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("channel", "agent_memory")
    .maybeSingle();

  if (!data?.credentials) return { preferences: {} };
  return data.credentials as unknown as MemoryStore;
}

async function saveMemoryStore(userId: string, companyId: string, store: MemoryStore): Promise<void> {
  const supabase = createAdminSupabaseClient();
  await supabase
    .from("channel_credentials")
    .upsert(
      {
        user_id: userId,
        company_id: companyId,
        channel: "agent_memory",
        credentials: { ...store, updatedAt: new Date().toISOString() },
        status: "connected",
      },
      { onConflict: "user_id,channel" }
    );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns everything the agent needs to remember, formatted for AI prompt injection.
 */
export async function getAgentMemory(
  userId: string,
  companyId: string
): Promise<AgentMemoryContext> {
  const supabase = createAdminSupabaseClient();

  // Parallel fetch: preferences + answered questions + identity count
  const [storeResult, questionsResult, identitiesResult] = await Promise.all([
    loadMemoryStore(userId, companyId),
    supabase
      .from("agent_questions")
      .select("question, answer, created_at")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .eq("status", "answered")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("contact_channel_links")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
  ]);

  const preferences = storeResult.preferences ?? {};
  const answers = (questionsResult.data ?? []).map((q) => ({
    question: q.question,
    answer: q.answer ?? "",
    date: new Date(q.created_at).toLocaleDateString("es-AR"),
  }));
  const resolvedIdentitiesCount = identitiesResult.count ?? 0;

  // Build prompt context
  const parts: string[] = [];

  if (Object.keys(preferences).length > 0) {
    parts.push(
      "Preferencias aprendidas del vendedor:\n" +
        Object.entries(preferences)
          .map(([, v]) => `• ${v}`)
          .join("\n")
    );
  }

  if (answers.length > 0) {
    parts.push(
      "Preguntas ya respondidas (no volver a preguntar sobre estos temas):\n" +
        answers
          .slice(0, 15)
          .map((a) => `• [${a.date}] "${a.question.slice(0, 80)}" → "${a.answer.slice(0, 80)}"`)
          .join("\n")
    );
  }

  if (resolvedIdentitiesCount > 0) {
    parts.push(
      `El agente tiene ${resolvedIdentitiesCount} identidades de contacto resueltas entre canales.`
    );
  }

  return {
    promptContext: parts.join("\n\n"),
    resolvedIdentitiesCount,
    recentAnswers: answers,
    learnedPreferences: preferences,
  };
}

/**
 * Checks if a very similar question was already asked and answered.
 * Returns the cached answer if found (threshold: 0.55 token overlap).
 * Use this before queueing new questions to avoid asking the same thing twice.
 */
export async function hasSimilarAnsweredQuestion(
  question: string,
  userId: string,
  companyId: string
): Promise<{ found: boolean; answer?: string }> {
  const supabase = createAdminSupabaseClient();

  const { data: answered } = await supabase
    .from("agent_questions")
    .select("question, answer")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("status", "answered")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!answered?.length) return { found: false };

  let bestScore = 0;
  let bestAnswer: string | undefined;

  for (const q of answered) {
    const score = tokenScore(question, q.question);
    if (score > bestScore) {
      bestScore = score;
      bestAnswer = q.answer ?? undefined;
    }
  }

  if (bestScore >= 0.55) {
    return { found: true, answer: bestAnswer };
  }

  return { found: false };
}

/**
 * Saves a vendor-taught rule or preference.
 * key: short identifier (e.g. "deal_split_producto_x")
 * value: human-readable rule (e.g. "Producto X siempre crea un deal separado.")
 */
export async function recordLearnedPreference(
  userId: string,
  companyId: string,
  key: string,
  value: string
): Promise<void> {
  const store = await loadMemoryStore(userId, companyId);
  store.preferences[key] = value;
  await saveMemoryStore(userId, companyId, store);
}

/**
 * Removes a learned preference by key.
 */
export async function removeLearnedPreference(
  userId: string,
  companyId: string,
  key: string
): Promise<void> {
  const store = await loadMemoryStore(userId, companyId);
  delete store.preferences[key];
  await saveMemoryStore(userId, companyId, store);
}
