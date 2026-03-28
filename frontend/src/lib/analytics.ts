import type {
  AnalyticsClient,
  AnalyticsCompanyContext,
  AnalyticsReport,
  ClientInteractionHistoryItem,
  ClientLeadHistoryItem,
  Lead,
  PurchaseSignal,
} from "@/lib/types";

const STATUS_WEIGHTS: Record<Lead["status"], number> = {
  new: 0.2,
  contacted: 0.4,
  negotiating: 0.7,
  closed_won: 1,
  closed_lost: 0.05,
};

const STATUS_LABELS: Record<Lead["status"], string> = {
  new: "Nuevo",
  contacted: "Contactado",
  negotiating: "Negociando",
  closed_won: "Ganado",
  closed_lost: "Perdido",
};

const SENTIMENT_WEIGHTS = {
  negative: 0.1,
  neutral: 0.5,
  positive: 0.85,
} as const;

type GroupedClient = {
  client_key: string;
  client_name: string;
  client_company: string | null;
  leads: Lead[];
  interactions: ClientInteractionHistoryItem[];
};

function average(values: number[], defaultValue = 0) {
  if (values.length === 0) {
    return defaultValue;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function median(values: number[]) {
  if (values.length === 0) {
    return 1;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function parseDate(value?: string | null) {
  return new Date(value ?? new Date().toISOString());
}

function daysBetween(first: Date, second: Date) {
  return Math.max((second.getTime() - first.getTime()) / 86400000, 0);
}

function normalizeClientKey(lead: Lead) {
  const clientName = (lead.client_name ?? "").trim().toLowerCase();
  const clientCompany = (lead.client_company ?? "").trim().toLowerCase();
  return clientName || clientCompany
    ? `${clientName}::${clientCompany}`
    : `lead::${lead.id}`;
}

function mostCommon(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function getPortfolioBaseline(leads: Lead[]) {
  const amounts = leads
    .map((lead) => lead.estimated_amount ?? 0)
    .filter((amount): amount is number => amount > 0);
  return Math.max(median(amounts), 1);
}

function getPurchaseSignal(probability: number): PurchaseSignal {
  if (probability >= 0.8) {
    return {
      level: "muy_alta",
      label: "Muy alta",
      description: "Conviene priorizar cierre y oferta concreta en este ciclo.",
    };
  }
  if (probability >= 0.65) {
    return {
      level: "alta",
      label: "Alta",
      description: "Hay señales de compra consistentes y buena traccion reciente.",
    };
  }
  if (probability >= 0.45) {
    return {
      level: "media",
      label: "Media",
      description: "Existe interes, pero todavia depende del seguimiento comercial.",
    };
  }
  if (probability >= 0.25) {
    return {
      level: "baja",
      label: "Baja",
      description:
        "La oportunidad sigue abierta, aunque sin señales fuertes de conversion.",
    };
  }
  return {
    level: "muy_baja",
    label: "Muy baja",
    description: "Hoy no aparecen indicios suficientes de compra proxima.",
  };
}

function buildClientGroups(context: AnalyticsCompanyContext): GroupedClient[] {
  const groupedLeads = new Map<string, Lead[]>();
  const leadToClientKey = new Map<string, string>();

  for (const lead of context.leads) {
    const clientKey = normalizeClientKey(lead);
    const existing = groupedLeads.get(clientKey) ?? [];
    existing.push(lead);
    groupedLeads.set(clientKey, existing);
    leadToClientKey.set(lead.id, clientKey);
  }

  const groupedInteractions = new Map<string, ClientInteractionHistoryItem[]>();
  for (const interaction of context.interactions) {
    const clientKey = leadToClientKey.get(interaction.lead_id);
    if (!clientKey) {
      continue;
    }

    const existing = groupedInteractions.get(clientKey) ?? [];
    existing.push({
      id: interaction.id,
      created_at: interaction.created_at,
      summary: interaction.summary,
      raw_messages: interaction.raw_messages,
      extracted_data: interaction.extracted_data,
    });
    groupedInteractions.set(clientKey, existing);
  }

  return Array.from(groupedLeads.entries()).map(([clientKey, leads]) => {
    const sortedLeads = [...leads].sort((a, b) => {
      return (
        parseDate(b.last_interaction ?? b.created_at).getTime() -
        parseDate(a.last_interaction ?? a.created_at).getTime()
      );
    });

    return {
      client_key: clientKey,
      client_name: sortedLeads[0]?.client_name ?? "Sin nombre",
      client_company: sortedLeads[0]?.client_company ?? null,
      leads: sortedLeads,
      interactions: [...(groupedInteractions.get(clientKey) ?? [])].sort(
        (a, b) => parseDate(a.created_at).getTime() - parseDate(b.created_at).getTime()
      ),
    };
  });
}

function resolveSegment({
  probability,
  recencyDays,
  interactionCount,
  wonCount,
  lostCount,
}: {
  probability: number;
  recencyDays: number;
  interactionCount: number;
  wonCount: number;
  lostCount: number;
}) {
  if (lostCount > wonCount && recencyDays > 45) {
    return { key: "en_riesgo", label: "En riesgo" };
  }
  if (probability >= 0.75 && interactionCount >= 4) {
    return { key: "alto_valor", label: "Alto valor" };
  }
  if (probability >= 0.55 && interactionCount >= 2) {
    return { key: "expansion", label: "En expansion" };
  }
  if (interactionCount <= 1) {
    return { key: "exploratorio", label: "Exploratorio" };
  }
  return { key: "ocasional", label: "Ocasional" };
}

function buildTopDrivers({
  currentStatus,
  recencyDays,
  interactionCount,
  topProduct,
  signal,
}: {
  currentStatus: Lead["status"];
  recencyDays: number;
  interactionCount: number;
  topProduct: string | null;
  signal: PurchaseSignal;
}) {
  const drivers = [`Estado actual: ${STATUS_LABELS[currentStatus]}`];

  if (recencyDays <= 14) {
    drivers.push("Interaccion reciente en los ultimos 14 dias");
  } else if (recencyDays >= 45) {
    drivers.push("Baja actividad reciente");
  }

  if (interactionCount >= 4) {
    drivers.push("Frecuencia de contacto superior al promedio");
  } else if (interactionCount <= 1) {
    drivers.push("Pocas interacciones registradas");
  }

  if (topProduct) {
    drivers.push(`Producto dominante: ${topProduct}`);
  }

  drivers.push(`Indicador de compra ${signal.label.toLowerCase()}`);
  return drivers;
}

function analyzeGroup(
  group: GroupedClient,
  baseline: number,
  now = new Date()
): AnalyticsClient {
  const recentLead = group.leads[0];
  const statuses = group.leads.map((lead) => lead.status);
  const sentiments = group.leads
    .map((lead) => lead.sentiment)
    .filter((value): value is keyof typeof SENTIMENT_WEIGHTS => Boolean(value));
  const products = group.leads
    .map((lead) => lead.product_interest)
    .filter((value): value is string => Boolean(value));
  const amounts = group.leads
    .map((lead) => lead.estimated_amount)
    .filter((value): value is number => Boolean(value && value > 0));

  const leadDates = group.leads.map((lead) =>
    parseDate(lead.last_interaction ?? lead.created_at)
  );
  const interactionDates = group.interactions.map((interaction) =>
    parseDate(interaction.created_at)
  );
  const touchpoints = [...leadDates, ...interactionDates].sort(
    (a, b) => a.getTime() - b.getTime()
  );
  const lastTouchpoint = touchpoints.at(-1) ?? now;

  const recencyDays = daysBetween(lastTouchpoint, now);
  const gaps = touchpoints.slice(1).map((date, index) =>
    daysBetween(touchpoints[index], date)
  );
  const cadenceDays = average(gaps.filter((gap) => gap > 0), 30);
  const interactionCount = Math.max(group.interactions.length, group.leads.length);
  const statusScore = average(statuses.map((status) => STATUS_WEIGHTS[status]), 0.2);
  const sentimentScore = average(
    sentiments.map((sentiment) => SENTIMENT_WEIGHTS[sentiment]),
    0.5
  );
  const recencyScore = Math.exp(-recencyDays / 45);
  const frequencyScore = clamp(interactionCount / 6, 0.1, 1);
  const wonCount = statuses.filter((status) => status === "closed_won").length;
  const lostCount = statuses.filter((status) => status === "closed_lost").length;
  const historyScore = wonCount / Math.max(group.leads.length, 1);
  const lossPenalty = lostCount / Math.max(group.leads.length, 1);
  const averageAmount = average(amounts, 0);
  const monetaryScore = clamp(averageAmount / baseline, 0, 2) / 2;

  const purchaseProbability = clamp(
    0.3 * statusScore +
      0.2 * sentimentScore +
      0.2 * recencyScore +
      0.15 * frequencyScore +
      0.15 * historyScore -
      0.15 * lossPenalty,
    0.05,
    0.98
  );

  const predicted30dAmount = Number(
    (
      averageAmount *
      purchaseProbability *
      (0.85 + frequencyScore * 0.35 + monetaryScore * 0.2)
    ).toFixed(2)
  );
  const predicted90dAmount = Number(
    (
      predicted30dAmount *
      (1.9 + historyScore * 0.4 + frequencyScore * 0.2)
    ).toFixed(2)
  );
  const urgencyFactor = clamp(1.85 - statusScore - sentimentScore / 2, 0.55, 1.6);
  const predictedNextPurchaseDays = Math.max(7, Math.round(cadenceDays * urgencyFactor));
  const dominantProduct = products.length > 0 ? mostCommon(products) : null;
  const purchaseSignal = getPurchaseSignal(purchaseProbability);
  const segment = resolveSegment({
    probability: purchaseProbability,
    recencyDays,
    interactionCount,
    wonCount,
    lostCount,
  });

  const sellerNames = Array.from(
    new Set(group.leads.map((lead) => lead.sellers?.name).filter(Boolean))
  ) as string[];

  const leadHistory: ClientLeadHistoryItem[] = group.leads.map((lead) => ({
    id: lead.id,
    status: lead.status,
    estimated_amount: lead.estimated_amount,
    currency: lead.currency,
    product_interest: lead.product_interest,
    next_steps: lead.next_steps,
    last_interaction: lead.last_interaction,
    created_at: lead.created_at,
    seller_name: lead.sellers?.name ?? null,
    sentiment: lead.sentiment,
  }));

  return {
    client_key: group.client_key,
    primary_lead_id: recentLead.id,
    lead_ids: group.leads.map((lead) => lead.id),
    client_name: group.client_name,
    client_company: group.client_company,
    current_status: recentLead.status,
    dominant_product: dominantProduct,
    dominant_currency: recentLead.currency,
    average_estimated_amount: Number(averageAmount.toFixed(2)),
    predicted_30d_amount: predicted30dAmount,
    predicted_90d_amount: predicted90dAmount,
    purchase_probability_30d: Number(purchaseProbability.toFixed(4)),
    purchase_signal: purchaseSignal,
    predicted_next_purchase_days: predictedNextPurchaseDays,
    recency_days: Number(recencyDays.toFixed(1)),
    average_cadence_days: Number(cadenceDays.toFixed(1)),
    confidence_score: Number(
      clamp(
        0.35 + Math.min(group.leads.length, 4) * 0.1 + Math.min(group.interactions.length, 6) * 0.05,
        0.35,
        0.95
      ).toFixed(4)
    ),
    lead_count: group.leads.length,
    interaction_count: group.interactions.length,
    closed_won_count: wonCount,
    closed_won_amount: group.leads
      .filter((lead) => lead.status === "closed_won")
      .reduce((sum, lead) => sum + (lead.estimated_amount ?? 0), 0),
    segment: segment.key,
    segment_label: segment.label,
    top_drivers: buildTopDrivers({
      currentStatus: recentLead.status,
      recencyDays,
      interactionCount: group.interactions.length,
      topProduct: dominantProduct,
      signal: purchaseSignal,
    }),
    seller_names: sellerNames,
    lead_history: leadHistory,
    interaction_history: group.interactions,
  };
}

export function buildAnalyticsReport(context: AnalyticsCompanyContext): AnalyticsReport {
  const baseline = getPortfolioBaseline(context.leads);
  const now = new Date();
  const clients = buildClientGroups(context)
    .map((group) => analyzeGroup(group, baseline, now))
    .sort((a, b) => {
      if (b.predicted_30d_amount !== a.predicted_30d_amount) {
        return b.predicted_30d_amount - a.predicted_30d_amount;
      }
      if (b.purchase_probability_30d !== a.purchase_probability_30d) {
        return b.purchase_probability_30d - a.purchase_probability_30d;
      }
      return a.recency_days - b.recency_days;
    });

  const topProducts = new Map<string, number>();
  const segmentBreakdown = new Map<string, number>();

  for (const client of clients) {
    if (client.dominant_product) {
      topProducts.set(
        client.dominant_product,
        (topProducts.get(client.dominant_product) ?? 0) + 1
      );
    }

    segmentBreakdown.set(
      client.segment_label,
      (segmentBreakdown.get(client.segment_label) ?? 0) + 1
    );
  }

  return {
    summary: {
      company_id: context.company.id,
      company_name: context.company.name,
      generated_at: now.toISOString(),
      total_clients: clients.length,
      total_leads: context.leads.length,
      total_interactions: context.interactions.length,
      predicted_30d_revenue: Number(
        clients.reduce((sum, client) => sum + client.predicted_30d_amount, 0).toFixed(2)
      ),
      predicted_90d_revenue: Number(
        clients.reduce((sum, client) => sum + client.predicted_90d_amount, 0).toFixed(2)
      ),
      average_purchase_probability_30d: Number(
        average(clients.map((client) => client.purchase_probability_30d), 0).toFixed(4)
      ),
      top_products: [...topProducts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([product, clientsCount]) => ({
          product,
          clients: clientsCount,
        })),
      segment_breakdown: Object.fromEntries(segmentBreakdown.entries()),
    },
    clients,
  };
}

export function getClientAnalyticsByLeadId(report: AnalyticsReport, leadId: string) {
  return report.clients.find((client) => client.lead_ids.includes(leadId)) ?? null;
}

export function getStatusLabel(status: Lead["status"]) {
  return STATUS_LABELS[status];
}
