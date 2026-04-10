import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type ActivityType = Database["public"]["Enums"]["activity_type"];
type EntrySource = Database["public"]["Enums"]["entry_source"];

export interface CreateActivityParams {
  companyId: string;
  userId: string;
  type: ActivityType;
  title: string;
  description?: string;
  leadId?: string;
  contactId?: string;
  source?: EntrySource;
  scheduledAt?: string;
  completedAt?: string;
}

/**
 * Create a new activity record
 */
export async function createActivity(params: CreateActivityParams) {
  const supabase = createAdminSupabaseClient();

  const { error } = await supabase.from("activities").insert({
    company_id: params.companyId,
    user_id: params.userId,
    lead_id: params.leadId,
    contact_id: params.contactId,
    type: params.type,
    title: params.title,
    description: params.description,
    source: params.source || "manual",
    scheduled_at: params.scheduledAt,
    completed_at: params.completedAt,
  });

  if (error) {
    throw error;
  }
}

/**
 * Create a contact from WhatsApp message sender
 */
export async function createOrFindWhatsAppContact(params: {
  companyId: string;
  userId: string;
  phoneNumber: string;
}) {
  const supabase = createAdminSupabaseClient();
  const normalizedPhone = params.phoneNumber.replace(/\D/g, "");

  // Try to find existing contact
  const { data: existingContact } = await supabase
    .from("contacts")
    .select("id")
    .eq("company_id", params.companyId)
    .eq("phone", normalizedPhone)
    .maybeSingle();

  if (existingContact) {
    return existingContact.id;
  }

  // Create new contact
  const { data: newContact, error } = await supabase
    .from("contacts")
    .insert({
      company_id: params.companyId,
      first_name: "WhatsApp",
      last_name: normalizedPhone,
      phone: normalizedPhone,
      source: "whatsapp" as const,
      created_by: params.userId,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return newContact?.id;
}

/**
 * Create activity from WhatsApp message
 */
export async function createWhatsAppActivity(params: {
  companyId: string;
  vendorId: string;
  contactId: string;
  messageBody: string;
  messageTimestamp: number;
  media?: {
    url: string;
    type: string;
  };
}) {
  const activityTitle = params.messageBody.substring(0, 100);

  await createActivity({
    companyId: params.companyId,
    userId: params.vendorId,
    contactId: params.contactId,
    type: "whatsapp",
    title: activityTitle || "Mensaje de WhatsApp",
    description: params.messageBody,
    source: "automatic",
  });
}
