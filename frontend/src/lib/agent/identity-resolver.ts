/**
 * Identity Resolver — cross-channel contact matching
 *
 * Given a phone, email, or name+company, finds the right CRM contact.
 * Resolution order:
 *   1. contact_channel_links (fastest — already linked)
 *   2. contacts.email / contacts.phone exact match → auto-link with high confidence
 *   3. name + company fuzzy match → medium confidence (vendor must confirm)
 *   4. null → agent will ask the vendor
 */

import { createAdminSupabaseClient } from "@/lib/supabase/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Channel = "whatsapp" | "gmail" | "fathom" | "manual";
export type Confidence = "high" | "medium";

export interface ResolvedIdentity {
  contactId: string;
  confidence: Confidence;
  /** How the match was found — useful for logging */
  method: "channel_link" | "email_exact" | "phone_exact" | "name_fuzzy";
}

export interface ResolveInput {
  companyId: string;
  channel: Channel;
  /** The raw identifier coming from the channel (phone, email, fathom invitee id) */
  identifier?: string;
  /** Optional enrichment for fuzzy matching */
  name?: string;
  company?: string;
}

// ─── Phone normalisation ──────────────────────────────────────────────────────
// Argentine numbers come in many flavours:
//   +5491134567890  →  5491134567890
//   0054911...      →  5491134567890
//   011 1234-5678   →  541112345678
//   15 1234-5678    →  (needs area code context, stored as-is with 54 prefix)
//
// We generate several candidate variants and match any of them.

function digits(s: string): string {
  return s.replace(/\D/g, "");
}

export function normalizePhone(raw: string): string[] {
  // Strip all non-digits, then remove leading international dialing prefix "00"
  let d = digits(raw);
  if (d.startsWith("00")) d = d.slice(2);

  const candidates = new Set<string>();
  candidates.add(d);

  // Already has Argentine country code 54
  if (d.startsWith("54")) {
    const withoutCountry = d.slice(2);
    candidates.add(withoutCountry);

    // +54 9 11 xxxx (with mobile 9) ↔ +54 11 xxxx (without)
    if (d.startsWith("549")) {
      candidates.add("54" + d.slice(3)); // remove the 9
    } else if (d.length >= 12) {
      candidates.add("549" + d.slice(2)); // add the 9
    }
  } else {
    // No country code — add it
    candidates.add("54" + d);
    candidates.add("549" + d);

    // Local Buenos Aires conventions
    if (d.startsWith("11") || d.startsWith("011")) {
      const local = d.startsWith("011") ? d.slice(3) : d.slice(2);
      candidates.add("5411" + local);
      candidates.add("54911" + local);
    }
    // Mobile "15" prefix: 15-xxxx-xxxx → 549-area-xxxx (area unknown, keep as-is)
    if (d.startsWith("15")) {
      candidates.add("549" + d.slice(2));
    }
  }

  // Always include the bare 10-digit local form if we can derive it
  for (const c of [...candidates]) {
    if (c.startsWith("549") && c.length === 13) candidates.add(c.slice(3)); // 10 digits
    if (c.startsWith("54") && !c.startsWith("549") && c.length === 12) candidates.add(c.slice(2));
  }

  return Array.from(candidates).filter((c) => c.length >= 8);
}

// ─── Link helper ─────────────────────────────────────────────────────────────

async function ensureLink(
  companyId: string,
  contactId: string,
  channel: Channel,
  identifier: string,
  confidence: Confidence
) {
  const supabase = createAdminSupabaseClient();
  await supabase.from("contact_channel_links").upsert(
    { company_id: companyId, contact_id: contactId, channel, identifier, confidence },
    { onConflict: "company_id,channel,identifier" }
  );
}

// ─── Fuzzy name score (0–1) ───────────────────────────────────────────────────
// Simple token-overlap score — avoids a heavy dependency for a hackathon.

function tokenScore(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const tb = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let matches = 0;
  for (const t of ta) if (tb.has(t)) matches++;
  return matches / Math.max(ta.size, tb.size);
}

// ─── Main resolver ────────────────────────────────────────────────────────────

export async function resolveIdentity(
  input: ResolveInput
): Promise<ResolvedIdentity | null> {
  const supabase = createAdminSupabaseClient();
  const { companyId, channel, identifier, name, company } = input;

  // ── Step 1: look up existing channel links ────────────────────────────────
  if (identifier) {
    const candidates =
      channel === "whatsapp" ? normalizePhone(identifier) : [identifier.toLowerCase()];

    const { data: links } = await supabase
      .from("contact_channel_links")
      .select("contact_id, confidence")
      .eq("company_id", companyId)
      .eq("channel", channel)
      .in("identifier", candidates)
      .limit(1);

    if (links?.[0]) {
      return {
        contactId: links[0].contact_id,
        confidence: links[0].confidence as Confidence,
        method: "channel_link",
      };
    }
  }

  // ── Step 2a: email exact match ────────────────────────────────────────────
  if (identifier && (channel === "gmail" || identifier.includes("@"))) {
    const email = identifier.toLowerCase();
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("company_id", companyId)
      .eq("email", email)
      .maybeSingle();

    if (contact) {
      await ensureLink(companyId, contact.id, channel, email, "high");
      return { contactId: contact.id, confidence: "high", method: "email_exact" };
    }
  }

  // ── Step 2b: phone exact match (all normalised variants) ──────────────────
  if (identifier && channel === "whatsapp") {
    const variants = normalizePhone(identifier);

    // Try each variant against contacts.phone
    for (const v of variants) {
      // Match stored phone digits against our variant
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, phone")
        .eq("company_id", companyId)
        .not("phone", "is", null);

      const match = (contacts ?? []).find((c) => {
        const stored = normalizePhone(c.phone ?? "");
        return stored.some((s) => s === v || variants.includes(s));
      });

      if (match) {
        await ensureLink(companyId, match.id, channel, variants[0], "high");
        return { contactId: match.id, confidence: "high", method: "phone_exact" };
      }
    }
  }

  // ── Step 3: fuzzy name + company match ───────────────────────────────────
  if (name) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, company_name")
      .eq("company_id", companyId);

    let bestId: string | null = null;
    let bestScore = 0;

    for (const c of contacts ?? []) {
      const fullName = `${c.first_name} ${c.last_name}`.trim();
      let score = tokenScore(name, fullName);

      // Boost if company also matches
      if (company && c.company_name) {
        score = (score + tokenScore(company, c.company_name)) / 2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestId = c.id;
      }
    }

    // Threshold: at least 0.6 overlap to consider a fuzzy match
    if (bestId && bestScore >= 0.6) {
      // Don't auto-link yet — medium confidence means vendor must confirm first
      return { contactId: bestId, confidence: "medium", method: "name_fuzzy" };
    }
  }

  // ── Step 4: no match ─────────────────────────────────────────────────────
  return null;
}

// ─── Confirm a medium-confidence link (called when vendor answers question) ───

export async function confirmLink(
  companyId: string,
  contactId: string,
  channel: Channel,
  identifier: string
) {
  await ensureLink(companyId, contactId, channel, identifier, "high");
}

// ─── Register a brand-new link (called after creating a new contact) ──────────

export async function registerLink(
  companyId: string,
  contactId: string,
  channel: Channel,
  identifier: string,
  confidence: Confidence = "high"
) {
  await ensureLink(companyId, contactId, channel, identifier, confidence);
}
