/**
 * Agent Orchestrator — end-to-end CRM auto-population pipeline
 *
 * Single entry point for all channel events. Given raw text from WhatsApp,
 * Gmail, or Fathom, this module:
 *   1. Resolves the contact identity (cross-channel)
 *   2. Fetches contact history for AI context
 *   3. Extracts structured data with GPT-4o-mini
 *   4. Writes everything to the CRM
 *   5. Creates vendor questions for things that couldn't be resolved
 *
 * Usage:
 *   const result = await runAgent({ companyId, userId, source, rawText, ... });
 */

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { resolveIdentity, registerLink, type Channel } from "@/lib/agent/identity-resolver";
import { extractStructuredData, hasUsefulData, type DataSource } from "@/lib/agent/data-extractor";
import { writeTocrm } from "@/lib/agent/crm-writer";
import { getContactContext } from "@/lib/contact-context";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface AgentInput {
  companyId: string;
  /** The vendor who owns this interaction */
  userId: string;
  source: DataSource;
  /** Raw text from the channel (message, email body, meeting transcript) */
  rawText: string;
  /** Channel identifier (phone, email address, fathom meeting id) */
  channelIdentifier?: string;
  /**
   * Optional enrichment extracted before calling the agent
   * (e.g. sender name from email headers, attendee name from Fathom payload)
   */
  senderName?: string;
  senderCompany?: string;
  /** Activity timestamp — defaults to now() */
  occurredAt?: string;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export type AgentStatus =
  | "ok"              // Contact resolved, data written
  | "new_contact"     // Contact was created by the agent
  | "unresolved"      // Could not identify the contact
  | "no_data"         // Extraction returned nothing useful
  | "error";          // Unexpected failure

export interface AgentResult {
  status: AgentStatus;
  contactId: string | null;
  /** true if the contact was just created (wasn't in CRM before) */
  contactCreated: boolean;
  activityId: string | null;
  leadsCreated: string[];
  leadsUpdated: string[];
  contactFieldsUpdated: string[];
  /** Questions queued for the vendor */
  questionsCreated: number;
  /** Human-readable summary for logging */
  summary: string;
}

// ─── Vendor context helper ────────────────────────────────────────────────────

async function getVendorName(userId: string): Promise<string | undefined> {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("users")
    .select("name")
    .eq("id", userId)
    .maybeSingle();
  return data?.name ?? undefined;
}

// ─── Open deals fetcher ───────────────────────────────────────────────────────

async function getOpenDeals(
  contactId: string,
  companyId: string
): Promise<Array<{ id: string; title: string; value: number | null }>> {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("leads")
    .select("id, title, value")
    .eq("company_id", companyId)
    .eq("contact_id", contactId)
    .eq("status", "open");
  return data ?? [];
}

// ─── Contact creator ──────────────────────────────────────────────────────────

async function createContact(
  companyId: string,
  userId: string,
  source: DataSource,
  senderName?: string,
  extractedFirstName?: string | null,
  extractedLastName?: string | null,
  extractedEmail?: string | null,
  extractedPhone?: string | null,
  extractedCompany?: string | null,
): Promise<string | null> {
  const supabase = createAdminSupabaseClient();

  // Parse name from senderName if first/last not extracted
  let firstName = extractedFirstName;
  let lastName = extractedLastName;
  if (!firstName && senderName) {
    const parts = senderName.trim().split(/\s+/);
    firstName = parts[0] ?? null;
    lastName = parts.slice(1).join(" ") || null;
  }
  if (!firstName) firstName = "Desconocido";

  const sourceMap: Record<DataSource, "whatsapp" | "gmail" | "import"> = {
    whatsapp: "whatsapp",
    gmail: "gmail",
    fathom: "import",
  };

  const { data: contact } = await supabase
    .from("contacts")
    .insert({
      company_id: companyId,
      created_by: userId,
      first_name: firstName,
      last_name: lastName ?? "",
      email: extractedEmail ?? null,
      phone: extractedPhone ?? null,
      company_name: extractedCompany ?? null,
      source: sourceMap[source],
      tags: [],
    })
    .select("id")
    .single();

  return contact?.id ?? null;
}

// ─── Question queue ───────────────────────────────────────────────────────────

async function queueQuestion(
  companyId: string,
  userId: string,
  contactId: string | null,
  question: string,
  context: string
): Promise<void> {
  const supabase = createAdminSupabaseClient();
  await supabase.from("agent_questions").insert({
    company_id: companyId,
    user_id: userId,
    contact_id: contactId,
    question,
    context: context.slice(0, 500),
    status: "pending",
  });
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export async function runAgent(input: AgentInput): Promise<AgentResult> {
  const {
    companyId,
    userId,
    source,
    rawText,
    channelIdentifier,
    senderName,
    senderCompany,
    occurredAt = new Date().toISOString(),
  } = input;

  const channel: Channel = source; // DataSource and Channel overlap for whatsapp/gmail/fathom
  let questionsCreated = 0;
  let contactCreated = false;

  try {
    // ── Step 1: Resolve contact identity ────────────────────────────────────
    let resolved = await resolveIdentity({
      companyId,
      channel,
      identifier: channelIdentifier,
      name: senderName,
      company: senderCompany,
    });

    // ── Step 2a: Quick extraction to get name/email for contact creation ───
    // We do a lightweight extraction first if contact couldn't be resolved,
    // so we have a name to create the contact with.
    let contactId = resolved?.contactId ?? null;

    if (!resolved) {
      // Try to get email/phone from the text before giving up
      const quick = await extractStructuredData(rawText, source, {
        vendorName: await getVendorName(userId),
        knownContactName: senderName,
      });

      // Retry resolution with extracted email/phone
      if (quick.contact_info.email || quick.contact_info.phone) {
        resolved = await resolveIdentity({
          companyId,
          channel,
          identifier: quick.contact_info.email ?? quick.contact_info.phone ?? undefined,
          name: senderName ?? (`${quick.contact_info.first_name ?? ""} ${quick.contact_info.last_name ?? ""}`.trim() || undefined),
          company: senderCompany ?? quick.contact_info.company_name ?? undefined,
        });
      }

      if (!resolved) {
        // Create new contact from available data
        const newId = await createContact(
          companyId,
          userId,
          source,
          senderName,
          quick.contact_info.first_name,
          quick.contact_info.last_name,
          quick.contact_info.email,
          quick.contact_info.phone,
          quick.contact_info.company_name ?? senderCompany,
        );

        if (!newId) {
          // Queue question for vendor to identify this contact
          await queueQuestion(
            companyId,
            userId,
            null,
            senderName
              ? `¿Conocés a ${senderName}? El agente recibió un mensaje de esta persona pero no pudo identificarla en el CRM.`
              : `¿A quién corresponde esta interacción recibida vía ${source}?`,
            rawText
          );
          questionsCreated++;

          return {
            status: "unresolved",
            contactId: null,
            contactCreated: false,
            activityId: null,
            leadsCreated: [],
            leadsUpdated: [],
            contactFieldsUpdated: [],
            questionsCreated,
            summary: `No se pudo identificar al contacto. Pregunta creada para el vendedor.`,
          };
        }

        contactId = newId;
        contactCreated = true;

        // Register the channel link for the new contact
        if (channelIdentifier) {
          await registerLink(companyId, newId, channel, channelIdentifier);
        }
        if (quick.contact_info.email) {
          await registerLink(companyId, newId, "gmail", quick.contact_info.email.toLowerCase());
        }
        if (quick.contact_info.phone) {
          await registerLink(companyId, newId, "whatsapp", quick.contact_info.phone.replace(/\D/g, ""));
        }

        // Run the full write with the quick extraction
        if (!hasUsefulData(quick)) {
          return {
            status: "new_contact",
            contactId: newId,
            contactCreated: true,
            activityId: null,
            leadsCreated: [],
            leadsUpdated: [],
            contactFieldsUpdated: [],
            questionsCreated,
            summary: `Nuevo contacto creado: ${senderName ?? "Desconocido"}. Sin datos útiles adicionales.`,
          };
        }

        const writeResult = await writeTocrm({
          companyId,
          userId,
          contactId: newId,
          extracted: quick,
          source,
          rawText,
          channelIdentifier,
          channel,
          occurredAt,
        });

        return {
          status: "new_contact",
          contactId: newId,
          contactCreated: true,
          activityId: writeResult.activityId,
          leadsCreated: writeResult.leadsCreated,
          leadsUpdated: writeResult.leadsUpdated,
          contactFieldsUpdated: writeResult.contactFieldsUpdated,
          questionsCreated,
          summary: `Nuevo contacto creado. ${writeResult.activityId ? "Actividad registrada." : ""} ${writeResult.leadsCreated.length ? `${writeResult.leadsCreated.length} lead(s) creado(s).` : ""}`.trim(),
        };
      }

      contactId = resolved.contactId;
    }

    // ── Step 2b: Full extraction with context ────────────────────────────────
    const [vendorName, contactHistory, openDeals] = await Promise.all([
      getVendorName(userId),
      getContactContext(contactId!, companyId),
      getOpenDeals(contactId!, companyId),
    ]);

    const extracted = await extractStructuredData(rawText, source, {
      vendorName,
      knownContactName: senderName,
      knownCompanyName: senderCompany,
      contactHistory: contactHistory ?? undefined,
      openDeals,
    });

    if (!hasUsefulData(extracted)) {
      // Still create a minimal activity to log the interaction
      return {
        status: "no_data",
        contactId,
        contactCreated,
        activityId: null,
        leadsCreated: [],
        leadsUpdated: [],
        contactFieldsUpdated: [],
        questionsCreated,
        summary: `Contacto identificado pero sin datos útiles que extraer.`,
      };
    }

    // ── Step 3: Write to CRM ─────────────────────────────────────────────────
    const writeResult = await writeTocrm({
      companyId,
      userId,
      contactId: contactId!,
      extracted,
      source,
      rawText,
      channelIdentifier,
      channel,
      occurredAt,
    });

    // ── Step 4: Queue pending confirmations as vendor questions ──────────────
    for (const pending of writeResult.pendingConfirmations) {
      await queueQuestion(
        companyId,
        userId,
        contactId,
        `El agente encontró un valor distinto para "${pending.field}" del contacto:\n` +
        `• Valor actual: ${pending.currentValue}\n` +
        `• Nuevo valor detectado: ${pending.newValue}\n` +
        `¿Querés actualizar el dato?`,
        rawText
      );
      questionsCreated++;
    }

    const parts: string[] = [];
    if (writeResult.contactFieldsUpdated.length)
      parts.push(`${writeResult.contactFieldsUpdated.length} campo(s) actualizados`);
    if (writeResult.leadsCreated.length)
      parts.push(`${writeResult.leadsCreated.length} lead(s) creado(s)`);
    if (writeResult.leadsUpdated.length)
      parts.push(`${writeResult.leadsUpdated.length} lead(s) actualizado(s)`);
    if (writeResult.activityId)
      parts.push("actividad registrada");

    return {
      status: "ok",
      contactId,
      contactCreated,
      activityId: writeResult.activityId,
      leadsCreated: writeResult.leadsCreated,
      leadsUpdated: writeResult.leadsUpdated,
      contactFieldsUpdated: writeResult.contactFieldsUpdated,
      questionsCreated,
      summary: parts.join(", ") || "Sin cambios.",
    };
  } catch (err) {
    console.error("[orchestrator] unexpected error", err);
    return {
      status: "error",
      contactId: null,
      contactCreated: false,
      activityId: null,
      leadsCreated: [],
      leadsUpdated: [],
      contactFieldsUpdated: [],
      questionsCreated,
      summary: `Error inesperado: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
