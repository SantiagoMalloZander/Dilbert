/**
 * POST /app/api/webhooks/mercadopago
 *
 * MP notifies us of preapproval (subscription) changes. We never trust the
 * payload's state directly — we re-fetch the preapproval from MP (source of
 * truth) and mirror it into our subscriptions table + the company vendor_limit.
 */

import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getPreapproval } from "@/lib/billing/mercadopago";

// MP preapproval status → our internal status.
function mapStatus(mp: string): string {
  switch (mp) {
    case "authorized":
      return "active";
    case "paused":
      return "past_due";
    case "cancelled":
      return "canceled";
    default:
      return "pending";
  }
}

async function handle(request: Request) {
  const url = new URL(request.url);
  let type = url.searchParams.get("type") || url.searchParams.get("topic") || "";
  let id = url.searchParams.get("data.id") || url.searchParams.get("id") || "";

  // MP may also send the info in the JSON body.
  try {
    const body = (await request.json()) as { type?: string; data?: { id?: string } };
    type = body.type || type;
    id = body.data?.id || id;
  } catch {
    // query-string-only notification — fine
  }

  // We only care about subscription (preapproval) notifications.
  if (!id || !/preapproval/i.test(type || "")) {
    return NextResponse.json({ ok: true });
  }

  try {
    const pre = await getPreapproval(id);
    const companyId = pre.external_reference;
    if (companyId) {
      const status = mapStatus(pre.status);
      const supabase = createAdminSupabaseClient();
      await supabase
        .from("subscriptions")
        .upsert(
          {
            company_id: companyId,
            provider: "mercadopago",
            currency: "ars",
            mp_preapproval_id: pre.id,
            status,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_id" }
        );

      // On activation, align vendor_limit with the seats stored for this company.
      if (status === "active") {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("seats")
          .eq("company_id", companyId)
          .maybeSingle();
        if (sub?.seats && sub.seats > 0) {
          await supabase.from("companies").update({ vendor_limit: sub.seats }).eq("id", companyId);
        }
      }
    }
  } catch (err) {
    console.error("[webhooks/mercadopago] error", err);
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  return handle(request);
}

// MP sometimes probes with GET.
export async function GET(request: Request) {
  return handle(request);
}
