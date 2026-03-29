"""
HubSpot sync — called after every lead upsert in db.py.
Creates/updates a Contact + Deal and links them.
Uses httpx.Client (sync) to stay compatible with the sync db layer.
"""

import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

HS_BASE = "https://api.hubapi.com"

STAGE_MAP = {
    "new": "appointmentscheduled",
    "contacted": "qualifiedtobuy",
    "negotiating": "presentationscheduled",
    "closed_won": "closedwon",
    "closed_lost": "closedlost",
}


def _client(token: str) -> httpx.Client:
    return httpx.Client(
        base_url=HS_BASE,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        timeout=10,
    )


def _search(hs: httpx.Client, object_type: str, prop: str, value: str) -> Optional[dict]:
    res = hs.post(
        f"/crm/v3/objects/{object_type}/search",
        json={"filterGroups": [{"filters": [{"propertyName": prop, "operator": "EQ", "value": value}]}], "limit": 1},
    )
    data = res.json()
    results = data.get("results", [])
    return results[0] if results else None


def sync_lead(lead: dict, token: str) -> None:
    """
    Upsert a Contact and a Deal in HubSpot for the given lead row.
    Silently logs errors — never raises so the bot flow keeps running.
    """
    try:
        _do_sync(lead, token)
    except Exception as exc:
        logger.warning("hubspot sync failed for lead %s: %s", lead.get("id"), exc)


def _do_sync(lead: dict, token: str) -> None:
    client_name: str = lead.get("client_name") or f"Lead-{lead.get('id', 'unknown')}"
    client_company: str = lead.get("client_company") or ""
    product: str = lead.get("product_interest") or "Deal"
    amount = lead.get("estimated_amount")
    status: str = lead.get("status", "new")
    next_steps: str = lead.get("next_steps") or ""
    sentiment: str = lead.get("sentiment") or ""
    lead_id: str = str(lead.get("id", ""))

    # Derive a stable dummy email for deduplication
    email = f"{client_name.lower().replace(' ', '.')}-{lead_id[:8]}@dilbert.demo"

    name_parts = client_name.split(" ", 1)
    firstname = name_parts[0]
    lastname = name_parts[1] if len(name_parts) > 1 else client_company

    with _client(token) as hs:
        # ── Contact ──────────────────────────────────────────────────────────
        existing_contact = _search(hs, "contacts", "email", email)
        contact_props = {"firstname": firstname, "lastname": lastname, "company": client_company}

        if existing_contact:
            contact_res = hs.patch(f"/crm/v3/objects/contacts/{existing_contact['id']}", json={"properties": contact_props})
        else:
            contact_res = hs.post("/crm/v3/objects/contacts", json={"properties": {**contact_props, "email": email}})

        contact_id = contact_res.json().get("id")

        # ── Deal ─────────────────────────────────────────────────────────────
        deal_name = f"{product} — {client_name}"
        deal_props = {
            "dealname": deal_name,
            "amount": str(amount) if amount is not None else "0",
            "dealstage": STAGE_MAP.get(status, "appointmentscheduled"),
            "pipeline": "default",
            "description": f"next_steps: {next_steps} | sentiment: {sentiment} | dilbert_id: {lead_id}",
        }

        # Use dilbert_id embedded in description as dedup key
        existing_deal = _search(hs, "deals", "description", lead_id)
        if existing_deal:
            deal_res = hs.patch(f"/crm/v3/objects/deals/{existing_deal['id']}", json={"properties": deal_props})
        else:
            deal_res = hs.post("/crm/v3/objects/deals", json={"properties": deal_props})

        deal_id = deal_res.json().get("id")

        # ── Associate ────────────────────────────────────────────────────────
        if contact_id and deal_id:
            hs.put(
                f"/crm/v4/objects/contacts/{contact_id}/associations/deals/{deal_id}",
                json=[{"associationCategory": "HUBSPOT_DEFINED", "associationTypeId": "3"}],
            )

    logger.info("hubspot synced lead=%s contact=%s deal=%s", lead_id, contact_id, deal_id)
