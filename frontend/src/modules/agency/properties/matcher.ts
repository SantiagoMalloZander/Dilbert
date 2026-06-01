/**
 * Property matcher — scores each available property against a lead's search
 * criteria and returns the top suggestions.
 *
 * Pure function, no DB access. The caller is responsible for fetching the
 * available property pool and feeding the lead's criteria in.
 */

import type { PropertyRecord } from "@/modules/agency/properties/types";

/** Minimum subset of the lead's real-estate fields used for matching. */
export interface PropertyMatcherCriteria {
  operationType: string | null;
  propertyType: string | null;
  zone: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  rooms: number | null;
  bedrooms: number | null;
  financing: string | null;
}

export interface PropertyMatch {
  property: PropertyRecord;
  score: number;
  /** Human-readable reasons (used as badges on the suggestion card). */
  reasons: string[];
}

const MIN_SCORE = 3;
const MAX_SUGGESTIONS = 3;

/**
 * Lead intent → catalog operation_type values that can satisfy it.
 *   compra   → "venta"
 *   alquiler → "alquiler" + "alquiler_temporario"
 *   (venta/tasacion ignored — those are sellers, not buyers/renters)
 */
function isOperationCompatible(leadOp: string | null, propertyOp: string): boolean {
  if (!leadOp) return false;
  if (leadOp === "compra") return propertyOp === "venta";
  if (leadOp === "alquiler") return propertyOp === "alquiler" || propertyOp === "alquiler_temporario";
  return false;
}

function priceInRange(price: number | null, min: number | null, max: number | null): boolean {
  if (price == null) return false;
  if (min != null && price < min) return false;
  if (max != null && price > max) return false;
  return true;
}

function zoneMatches(leadZone: string | null, propertyZone: string | null): boolean {
  if (!leadZone || !propertyZone) return false;
  const a = leadZone.toLowerCase().trim();
  const b = propertyZone.toLowerCase().trim();
  return a === b || a.includes(b) || b.includes(a);
}

export function findPropertyMatches(
  criteria: PropertyMatcherCriteria,
  properties: PropertyRecord[]
): PropertyMatch[] {
  // Only buyers / renters trigger suggestions. Sellers, owners offering and
  // tasaciones are on the other side of the trade.
  if (criteria.operationType !== "compra" && criteria.operationType !== "alquiler") return [];

  const matches: PropertyMatch[] = [];
  for (const property of properties) {
    if (property.status !== "disponible") continue;
    if (!isOperationCompatible(criteria.operationType, property.operationType)) continue;

    let score = 0;
    const reasons: string[] = [];

    if (criteria.propertyType && property.propertyType === criteria.propertyType) {
      score += 3;
      reasons.push("Tipo");
    }

    if (zoneMatches(criteria.zone, property.zone)) {
      score += 3;
      reasons.push("Zona");
    }

    if (priceInRange(property.price, criteria.budgetMin, criteria.budgetMax)) {
      score += 3;
      reasons.push("Presupuesto");
    }

    if (criteria.rooms != null && property.rooms != null && property.rooms >= criteria.rooms) {
      score += 1;
      reasons.push("Ambientes");
    }

    if (criteria.bedrooms != null && property.bedrooms != null && property.bedrooms >= criteria.bedrooms) {
      score += 1;
      reasons.push("Dormitorios");
    }

    if (criteria.financing === "credito" && property.mortgageEligible === true) {
      score += 1;
      reasons.push("Apto crédito");
    }

    if (score >= MIN_SCORE) {
      matches.push({ property, score, reasons });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, MAX_SUGGESTIONS);
}
