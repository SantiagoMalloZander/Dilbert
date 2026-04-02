import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession, USERS } from "@/lib/auth";

const HS_BASE = "https://api.hubapi.com";

const DEMO_COMPANY_ID = "11111111-1111-1111-1111-111111111111";

const STAGE_MAP: Record<string, string> = {
  new: "appointmentscheduled",
  contacted: "qualifiedtobuy",
  negotiating: "presentationscheduled",
  closed_won: "closedwon",
  closed_lost: "closedlost",
};

function makeHs(token: string) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  async function hsPost(path: string, body: object) {
    const res = await fetch(`${HS_BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
    return res.json();
  }
  async function hsPatch(path: string, body: object) {
    const res = await fetch(`${HS_BASE}${path}`, { method: "PATCH", headers, body: JSON.stringify(body) });
    return res.json();
  }
  async function hsSearch(objectType: string, filterProp: string, value: string) {
    const res = await fetch(`${HS_BASE}/crm/v3/objects/${objectType}/search`, {
      method: "POST", headers,
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: filterProp, operator: "EQ", value }] }],
        limit: 1,
      }),
    });
    const data = await res.json();
    return data.results?.[0] ?? null;
  }
  async function associate(fromType: string, fromId: string, toType: string, toId: string, assocType: string) {
    await fetch(`${HS_BASE}/crm/v4/objects/${fromType}/${fromId}/associations/${toType}/${toId}`, {
      method: "PUT", headers,
      body: JSON.stringify([{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: assocType }]),
    });
  }

  return { hsPost, hsPatch, hsSearch, associate };
}

export async function POST() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return NextResponse.json(
      { error: "Falta configurar la credencial server-side de Supabase." },
      { status: 500 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const session = await getSession();
  const userEntry = session ? USERS[session.username] : null;
  const token = userEntry?.hubspotKey ?? process.env.HUBSPOT_API_KEY;

  if (!token) {
    return NextResponse.json({ error: "HUBSPOT_API_KEY not configured" }, { status: 500 });
  }

  const hs = makeHs(token);

  const { data: leads, error } = await supabase
    .from("leads")
    .select("*, sellers(name)")
    .eq("company_id", DEMO_COMPANY_ID);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = { synced: 0, errors: [] as string[] };

  for (const lead of leads ?? []) {
    try {
      const email = lead.client_name
        ? `${lead.client_name.toLowerCase().replace(/\s+/g, ".")}@dilbert.demo`
        : `lead-${lead.id}@dilbert.demo`;

      const nameParts = (lead.client_name ?? "Lead").split(" ");
      const firstname = nameParts[0];
      const lastname = nameParts.slice(1).join(" ") || lead.client_company || "";

      let contact = await hs.hsSearch("contacts", "email", email);
      if (contact) {
        contact = await hs.hsPatch(`/crm/v3/objects/contacts/${contact.id}`, {
          properties: { firstname, lastname, company: lead.client_company ?? "" },
        });
      } else {
        contact = await hs.hsPost("/crm/v3/objects/contacts", {
          properties: { email, firstname, lastname, company: lead.client_company ?? "" },
        });
      }
      const contactId = contact.id;

      const dealName = `${lead.product_interest ?? "Deal"} — ${lead.client_name ?? "Cliente"}`;
      const dealProps = {
        dealname: dealName,
        amount: lead.estimated_amount?.toString() ?? "0",
        dealstage: STAGE_MAP[lead.status] ?? "appointmentscheduled",
        pipeline: "default",
        description: `next_steps: ${lead.next_steps ?? "-"} | sentiment: ${lead.sentiment ?? "-"} | dilbert_id: ${lead.id}`,
        closedate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      };

      let deal = await hs.hsSearch("deals", "description", lead.id);
      if (deal) {
        deal = await hs.hsPatch(`/crm/v3/objects/deals/${deal.id}`, { properties: dealProps });
      } else {
        deal = await hs.hsPost("/crm/v3/objects/deals", { properties: dealProps });
      }
      const dealId = deal.id;

      if (contactId && dealId) {
        await hs.associate("contacts", contactId, "deals", dealId, "3");
      }

      results.synced++;
    } catch (err) {
      results.errors.push(`Lead ${lead.client_name ?? lead.id}: ${err}`);
    }
  }

  return NextResponse.json(results);
}
