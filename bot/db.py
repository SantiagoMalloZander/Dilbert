import os
import json
from supabase import create_client

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY")
supabase = create_client(url, key)

async def save_interaction(
    chat_id: str,
    seller_telegram_id: str,
    raw_messages: list[dict],
    extracted_data: dict,
):
    # Find or create seller
    seller = supabase.table("sellers").select("*").eq(
        "telegram_user_id", seller_telegram_id
    ).maybe_single().execute()

    if not seller.data:
        return  # Seller not registered, skip

    seller_id = seller.data["id"]
    company_id = seller.data["company_id"]

    # Upsert lead
    lead_data = {
        "company_id": company_id,
        "seller_id": seller_id,
        "client_name": extracted_data.get("client_name"),
        "client_company": extracted_data.get("client_company"),
        "status": extracted_data.get("status", "new"),
        "estimated_amount": extracted_data.get("estimated_amount"),
        "currency": extracted_data.get("currency"),
        "product_interest": extracted_data.get("product_interest"),
        "sentiment": extracted_data.get("sentiment"),
        "next_steps": extracted_data.get("next_steps"),
    }

    lead = supabase.table("leads").insert(lead_data).execute()
    lead_id = lead.data[0]["id"]

    # Save interaction
    interaction_data = {
        "lead_id": lead_id,
        "seller_id": seller_id,
        "raw_messages": json.dumps(raw_messages),
        "extracted_data": extracted_data,
        "summary": extracted_data.get("summary"),
    }

    supabase.table("interactions").insert(interaction_data).execute()
