// Shared types and logic for meeting classification + smart questions

export type MeetingType =
  | "first_contact"
  | "demo"
  | "follow_up"
  | "negotiation"
  | "closing"
  | "internal"
  | "error"
  | "other";

export type QuestionFieldType = "text" | "select" | "number" | "date";

export interface MeetingQuestion {
  id: string;
  text: string;
  type: QuestionFieldType;
  options?: string[];
  /** Dot-notation field path: "contact.company_name", "lead.value",
   *  "new_contact.first_name", "deal_interest", "closing_outcome" */
  field: string;
  prefilled?: string;
  answer?: string | null;
  skipped?: boolean;
}

export interface MeetingMetadata {
  meeting_type?: MeetingType | string;
  questions?: MeetingQuestion[];
  enrichment_complete?: boolean;
  origin?: string;
  client_interest?: string;
  key_pain_points?: string[];
}

export const MEETING_TYPE_LABELS: Record<string, string> = {
  first_contact: "Primer contacto",
  demo: "Demo",
  follow_up: "Seguimiento",
  negotiation: "Negociación",
  closing: "Cierre",
  internal: "Interna",
  error: "Sin datos",
  other: "Reunión",
};

export function generateSmartQuestions({
  meetingType,
  contactId,
  contact,
  leadId,
  lead,
  hasDealPotential,
  analysisLeadValue,
  analysisCloseEstimate,
}: {
  meetingType: string;
  contactId: string | null;
  contact: { company_name?: string | null; position?: string | null } | null;
  leadId: string | null;
  lead: { value?: number | null; expected_close_date?: string | null } | null;
  hasDealPotential: boolean;
  analysisLeadValue?: number | null;
  analysisCloseEstimate?: string | null;
}): MeetingQuestion[] {
  if (meetingType === "internal" || meetingType === "error") return [];

  const questions: MeetingQuestion[] = [];

  // 1. No contact → ask who the meeting was with
  if (!contactId) {
    questions.push({
      id: "new_contact_name",
      text: "¿Con quién fue esta reunión? (Nombre completo)",
      type: "text",
      field: "new_contact.first_name",
    });
    questions.push({
      id: "new_contact_email",
      text: "¿Cuál es el email del contacto?",
      type: "text",
      field: "new_contact.email",
    });
    // Don't ask more until we have a contact identified
    return questions;
  }

  // 2. Missing contact company
  if (!contact?.company_name) {
    questions.push({
      id: "contact_company",
      text: "¿De qué empresa es este contacto?",
      type: "text",
      field: "contact.company_name",
    });
  }

  // 3. Missing contact position (only for relevant meeting types)
  if (
    !contact?.position &&
    ["first_contact", "demo", "negotiation"].includes(meetingType)
  ) {
    questions.push({
      id: "contact_position",
      text: "¿Cuál es el cargo del contacto en su empresa?",
      type: "text",
      field: "contact.position",
    });
  }

  // 4. Deal interest (when AI didn't detect a deal)
  if (
    !leadId &&
    !hasDealPotential &&
    ["first_contact", "demo", "follow_up", "other"].includes(meetingType)
  ) {
    questions.push({
      id: "deal_interest",
      text: "¿Surgió algún potencial de negocio de esta reunión?",
      type: "select",
      options: ["Sí, quiero crear un deal", "No por ahora", "Posiblemente más adelante"],
      field: "deal_interest",
    });
  }

  // 5. Lead value
  if (leadId && (lead?.value === null || lead?.value === undefined)) {
    questions.push({
      id: "lead_value",
      text: "¿Cuánto vale este deal estimado? (USD)",
      type: "number",
      field: "lead.value",
      prefilled: analysisLeadValue != null ? String(analysisLeadValue) : undefined,
    });
  }

  // 6. Lead close date
  if (leadId && !lead?.expected_close_date) {
    questions.push({
      id: "lead_close_date",
      text: "¿Para cuándo estimás que se puede cerrar este deal?",
      type: "date",
      field: "lead.expected_close_date",
      prefilled: analysisCloseEstimate ?? undefined,
    });
  }

  // 7. Closing outcome (only for closing meetings with a lead)
  if (meetingType === "closing" && leadId) {
    questions.push({
      id: "closing_outcome",
      text: "¿Cuál fue el resultado de esta reunión de cierre?",
      type: "select",
      options: [
        "Se cerró la venta",
        "Seguimos negociando",
        "El cliente no quiso avanzar",
      ],
      field: "closing_outcome",
    });
  }

  return questions.slice(0, 5);
}
