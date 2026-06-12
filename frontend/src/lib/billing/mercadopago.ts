/**
 * Mercado Pago client (REST). We use "preapproval" (subscription without a
 * pre-existing plan): create it with status "pending" + payer_email and MP
 * returns an init_point to redirect the payer to authorize the recurring charge.
 */

const MP_API = "https://api.mercadopago.com";

function accessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_NOT_CONFIGURED");
  return token;
}

async function mpFetch<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(`${MP_API}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
      ...(rest.headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`MP_ERROR: ${res.status} ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data as T;
}

export type MpPreapproval = {
  id: string;
  status: string; // pending | authorized | paused | cancelled
  init_point?: string;
  external_reference?: string;
  payer_email?: string;
  preapproval_plan_id?: string;
  auto_recurring?: { transaction_amount?: number; currency_id?: string };
  next_payment_date?: string;
};

export type MpPreapprovalPlan = {
  id: string;
  init_point?: string;
  external_reference?: string;
};

/**
 * Subscription PLAN ("suscripción con plan"). Unlike a direct preapproval, the
 * plan's init_point lets ANY Mercado Pago account subscribe with their own
 * login — we never bind a payer_email. Ideal for companies (the owner, the
 * accountant, whoever paga). We tie it to the company via external_reference
 * and confirm on return to /app/suscripcion (and via webhook).
 */
export async function createPreapprovalPlan(params: {
  companyId: string;
  seats: number;
  amountArs: number;
  backUrl: string;
}): Promise<MpPreapprovalPlan> {
  return mpFetch<MpPreapprovalPlan>("/preapproval_plan", {
    method: "POST",
    json: {
      reason: `Dilbert — CRM (${params.seats} ${params.seats === 1 ? "vendedor" : "vendedores"})`,
      external_reference: params.companyId,
      back_url: params.backUrl,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: params.amountArs,
        currency_id: "ARS",
      },
    },
  });
}

export async function createPreapproval(params: {
  companyId: string;
  email: string;
  seats: number;
  amountArs: number;
  backUrl: string;
  notificationUrl: string;
}): Promise<MpPreapproval> {
  return mpFetch<MpPreapproval>("/preapproval", {
    method: "POST",
    json: {
      reason: `Dilbert — CRM (${params.seats} ${params.seats === 1 ? "vendedor" : "vendedores"})`,
      external_reference: params.companyId,
      payer_email: params.email,
      back_url: params.backUrl,
      notification_url: params.notificationUrl,
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: params.amountArs,
        currency_id: "ARS",
      },
    },
  });
}

export async function getPreapproval(id: string): Promise<MpPreapproval> {
  return mpFetch<MpPreapproval>(`/preapproval/${id}`, { method: "GET" });
}
