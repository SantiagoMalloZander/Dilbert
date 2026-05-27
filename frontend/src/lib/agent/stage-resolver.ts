/**
 * Stage Resolver — maps AI-inferred stage keywords to a pipeline stage.
 *
 * Pure function: it receives the destination's stages (fetched via the
 * CRMConnector) and resolves a keyword like "propuesta" / "negociacion" to the
 * matching stage, using:
 *   1. is_won_stage / is_lost_stage flags for terminal stages (robust to custom names)
 *   2. Substring matching on stage name for intermediate stages
 *   3. Position heuristic fallback
 *
 * It no longer talks to the database — that keeps it destination-agnostic and
 * removes the stale module-level cache.
 */

import type { StageKeyword } from "@/lib/agent/data-extractor";
import type { PipelineStage } from "@/lib/agent/crm/types";

/** Remove accents and lowercase for fuzzy matching */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Given a stage keyword from the AI and the destination's stages, return the
 * best matching stage. Returns null if the keyword is null or no match is found.
 */
export function resolveStageByKeyword(
  stages: PipelineStage[],
  keyword: StageKeyword
): PipelineStage | null {
  if (!keyword) return null;
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
    en_contacto: ["contact", "contacto"],
    propuesta: ["propuest", "proposal", "cotiz"],
    negociacion: ["negoci", "negot"],
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
      propuesta: Math.floor(nonTerminal.length * 0.4),
      negociacion: Math.floor(nonTerminal.length * 0.7),
    };
    const idx = heuristic[keyword] ?? 0;
    return nonTerminal[idx] ?? nonTerminal[nonTerminal.length - 1] ?? null;
  }

  return match;
}
