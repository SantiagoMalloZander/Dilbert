/**
 * Stage Resolver — maps AI-inferred stage keywords to real pipeline_stages rows.
 *
 * The AI returns a keyword like "propuesta" or "negociacion". This module
 * resolves it to the actual stage ID in the company's pipeline, using:
 *   1. is_won_stage / is_lost_stage flags for terminal stages (robust to custom names)
 *   2. Substring matching on stage name for intermediate stages
 *   3. Position 0 fallback for "nuevo"
 *
 * A per-request in-memory cache avoids duplicate DB calls when processing
 * a single email that touches multiple branches.
 */

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { StageKeyword } from "@/lib/agent/data-extractor";

export interface ResolvedStage {
  id: string;
  name: string;
  position: number;
  is_won_stage: boolean;
  is_lost_stage: boolean;
}

// Simple in-memory cache keyed by pipelineId (lives for the duration of a single request)
const stageCache = new Map<string, ResolvedStage[]>();

async function getStages(companyId: string, pipelineId: string): Promise<ResolvedStage[]> {
  const key = `${companyId}:${pipelineId}`;
  if (stageCache.has(key)) return stageCache.get(key)!;

  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("pipeline_stages")
    .select("id, name, position, is_won_stage, is_lost_stage")
    .eq("company_id", companyId)
    .eq("pipeline_id", pipelineId)
    .order("position", { ascending: true });

  const stages = (data ?? []) as ResolvedStage[];
  stageCache.set(key, stages);
  return stages;
}

/** Remove accents and lowercase for fuzzy matching */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Given a stage keyword from the AI, return the best matching pipeline stage.
 * Returns null if the keyword is null or no match is found.
 */
export async function resolveStageByKeyword(
  companyId: string,
  pipelineId: string,
  keyword: StageKeyword
): Promise<ResolvedStage | null> {
  if (!keyword) return null;

  const stages = await getStages(companyId, pipelineId);
  if (!stages.length) return null;

  // Terminal stages — use flags, not names (works with any custom stage name)
  if (keyword === "ganado") {
    return stages.find((s) => s.is_won_stage) ?? null;
  }
  if (keyword === "perdido") {
    return stages.find((s) => s.is_lost_stage) ?? null;
  }

  // "nuevo" → first non-terminal stage (position 0)
  if (keyword === "nuevo") {
    return stages.find((s) => !s.is_won_stage && !s.is_lost_stage) ?? null;
  }

  // Intermediate stages — substring match on normalized name
  const KEYWORD_SUBSTRINGS: Record<string, string[]> = {
    en_contacto:  ["contact", "contacto"],
    propuesta:    ["propuest", "proposal", "cotiz"],
    negociacion:  ["negoci", "negot"],
  };

  const substrings = KEYWORD_SUBSTRINGS[keyword];
  if (!substrings) return null;

  const match = stages.find((s) => {
    const n = normalize(s.name);
    return substrings.some((sub) => n.includes(sub));
  });

  // Fallback: use position heuristic if name doesn't match
  if (!match) {
    const nonTerminal = stages.filter((s) => !s.is_won_stage && !s.is_lost_stage);
    const heuristic: Record<string, number> = {
      en_contacto: 0,
      propuesta:   Math.floor(nonTerminal.length * 0.4),
      negociacion: Math.floor(nonTerminal.length * 0.7),
    };
    const idx = heuristic[keyword] ?? 0;
    return nonTerminal[idx] ?? nonTerminal[nonTerminal.length - 1] ?? null;
  }

  return match;
}

/** Clear the cache — call at the start of each request if needed */
export function clearStageCache(): void {
  stageCache.clear();
}
