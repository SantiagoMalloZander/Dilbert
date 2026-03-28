import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from supabase import create_client, Client

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from extractor import ExtractionResult

logger = logging.getLogger(__name__)

_client: Optional[Client] = None


def _get_client() -> Client:
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_KEY are required for db operations."
            )
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client


# ---------------------------------------------------------------------------
# Sellers
# ---------------------------------------------------------------------------

def get_seller_by_telegram_id(telegram_user_id: int) -> Optional[dict]:
    """Return seller row or None if not registered."""
    db = _get_client()
    res = (
        db.table("sellers")
        .select("*")
        .eq("telegram_user_id", telegram_user_id)
        .execute()
    )
    return res.data[0] if res.data else None


# ---------------------------------------------------------------------------
# Leads
# ---------------------------------------------------------------------------

def find_lead(seller_id: str, client_name: str, client_company: Optional[str]) -> Optional[dict]:
    """Look up an existing lead by seller + client identity."""
    db = _get_client()
    query = (
        db.table("leads")
        .select("*")
        .eq("seller_id", seller_id)
        .ilike("client_name", client_name)
    )
    if client_company:
        query = query.ilike("client_company", client_company)
    res = query.execute()
    return res.data[0] if res.data else None


def create_lead(seller_id: str, company_id: str, result: ExtractionResult) -> dict:
    db = _get_client()
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "seller_id": seller_id,
        "company_id": company_id,
        "client_name": result.client_name,
        "client_company": result.client_company,
        "status": result.suggested_status,
        "estimated_amount": result.estimated_amount,
        "currency": result.currency,
        "product_interest": result.product_interest,
        "sentiment": result.sentiment,
        "next_steps": result.next_steps,
        "last_interaction": now,
    }
    res = db.table("leads").insert(row).execute()
    lead = res.data[0]
    logger.info("lead created id=%s client=%s", lead["id"], lead["client_name"])
    return lead


def update_lead(lead_id: str, result: ExtractionResult) -> dict:
    db = _get_client()
    now = datetime.now(timezone.utc).isoformat()
    updates = {
        "status": result.suggested_status,
        "estimated_amount": result.estimated_amount,
        "currency": result.currency,
        "product_interest": result.product_interest,
        "sentiment": result.sentiment,
        "next_steps": result.next_steps,
        "last_interaction": now,
    }
    # Only update fields that the LLM actually extracted (not null)
    updates = {k: v for k, v in updates.items() if v is not None}
    res = db.table("leads").update(updates).eq("id", lead_id).execute()
    lead = res.data[0]
    logger.info("lead updated id=%s", lead["id"])
    return lead


# ---------------------------------------------------------------------------
# Interactions
# ---------------------------------------------------------------------------

def create_interaction(lead_id: str, seller_id: str, transcript: str, result: ExtractionResult) -> dict:
    db = _get_client()
    row = {
        "lead_id": lead_id,
        "seller_id": seller_id,
        "raw_messages": transcript,
        "extracted_data": result.raw,
        "summary": result.summary,
    }
    res = db.table("interactions").insert(row).execute()
    interaction = res.data[0]
    logger.info("interaction created id=%s lead=%s", interaction["id"], lead_id)
    return interaction


# ---------------------------------------------------------------------------
# Main upsert — called from main.py after extraction
# ---------------------------------------------------------------------------

def upsert_lead_and_interaction(
    telegram_user_id: int,
    transcript: str,
    result: ExtractionResult,
) -> Optional[dict]:
    """
    Full write flow:
    1. Resolve seller from telegram_user_id
    2. Find or create lead
    3. Always create interaction
    Returns the lead row, or None if seller not found in DB.
    """
    seller = get_seller_by_telegram_id(telegram_user_id)
    if not seller:
        logger.warning("telegram_user_id=%s not found in sellers table — skipping DB write", telegram_user_id)
        return None

    seller_id = seller["id"]
    company_id = seller["company_id"]

    if result.client_name:
        existing = find_lead(seller_id, result.client_name, result.client_company)
    else:
        existing = None

    if existing:
        lead = update_lead(existing["id"], result)
    else:
        lead = create_lead(seller_id, company_id, result)

    create_interaction(lead["id"], seller_id, transcript, result)
    return lead
