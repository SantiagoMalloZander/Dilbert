import asyncio
import base64
import hashlib
import hmac
import json
import logging
from typing import Any, Optional

import aiohttp.web

import db
import extractor
from config import FATHOM_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY
from db import InteractionSourceMetadata

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# SVix HMAC-SHA256 signature validation
# ---------------------------------------------------------------------------

def _verify_svix_signature(
    body: bytes,
    webhook_id: str,
    webhook_timestamp: str,
    webhook_signature: str,
    secret: str,
) -> bool:
    """
    Validates a webhook signature using the SVix protocol.
    Signed content: "{webhook-id}.{webhook-timestamp}.{raw_body}"
    Header format:  "v1,<base64>" — multiple entries separated by spaces.
    Secret may have a "whsec_" prefix indicating a base64-encoded secret.
    """
    if secret.startswith("whsec_"):
        raw_secret = base64.b64decode(secret[len("whsec_"):])
    else:
        raw_secret = secret.encode()

    signed_content = f"{webhook_id}.{webhook_timestamp}.".encode() + body
    expected = base64.b64encode(
        hmac.new(raw_secret, signed_content, hashlib.sha256).digest()
    ).decode()

    # SVix may send multiple signatures separated by spaces during secret rotation
    for entry in webhook_signature.split(" "):
        if entry.startswith("v1,"):
            if hmac.compare_digest(expected, entry[3:]):
                return True
    return False


# ---------------------------------------------------------------------------
# Payload parsing
# ---------------------------------------------------------------------------

def _parse_fathom_payload(data: dict[str, Any]) -> tuple[str, str, dict[str, Any]]:
    """
    Parse a Fathom webhook payload defensively (exact schema not fully documented).

    Returns:
        recording_id: unique ID for deduplication
        formatted_transcript: plain text "Speaker: text\\n" lines
        fathom_metadata: extra fields to store in extracted_data JSONB
    """
    # Fathom may wrap data in an event envelope
    payload = data.get("data") or data.get("recording") or data

    recording_id = (
        payload.get("id")
        or payload.get("recording_id")
        or payload.get("call_id")
        or data.get("id")
        or "unknown"
    )

    # Transcript: array of {speaker, text, timestamp} or similar
    raw_transcript = payload.get("transcript") or payload.get("transcription") or []
    lines = []
    for entry in raw_transcript:
        speaker = (
            entry.get("speaker")
            or entry.get("name")
            or entry.get("speaker_name")
            or "Unknown"
        )
        text = entry.get("text") or entry.get("content") or entry.get("message") or ""
        if text:
            lines.append(f"{speaker}: {text}")

    # Fall back to summary if there's no structured transcript
    formatted_transcript = "\n".join(lines)
    if not formatted_transcript:
        summary = payload.get("summary") or payload.get("notes") or ""
        formatted_transcript = f"[Meeting summary]\n{summary}"

    fathom_metadata: dict[str, Any] = {
        "fathom_recording_id": recording_id,
        "participants": payload.get("participants") or payload.get("attendees") or [],
        "duration": payload.get("duration") or payload.get("duration_seconds"),
        "recording_url": payload.get("recording_url") or payload.get("video_url") or payload.get("url"),
        "summary": payload.get("summary") or payload.get("notes"),
        "fathom_event_type": data.get("type") or data.get("event_type"),
    }

    return recording_id, formatted_transcript, fathom_metadata


# ---------------------------------------------------------------------------
# Seller resolution
# ---------------------------------------------------------------------------

async def _resolve_seller() -> Optional[tuple[str, str]]:
    """
    Returns (seller_id, company_id) for the first seller in DB.
    Sufficient for a hackathon demo with 2-3 sellers.
    """
    try:
        sellers = await asyncio.to_thread(db.get_all_sellers)
        if not sellers:
            logger.error("fathom: no sellers found in DB — cannot process recording")
            return None
        seller = sellers[0]
        return seller["id"], seller["company_id"]
    except Exception as exc:
        logger.error("fathom: seller resolution failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Background processor
# ---------------------------------------------------------------------------

async def _process_fathom_recording(
    recording_id: str,
    source_key: str,
    formatted_transcript: str,
    fathom_metadata: dict[str, Any],
) -> None:
    """
    Runs in background after the HTTP handler already returned 200.
    Calls OpenAI extraction and writes to Supabase.
    """
    try:
        resolved = await _resolve_seller()
        if not resolved:
            logger.error("fathom: aborting recording_id=%s — no seller resolved", recording_id)
            return
        seller_id, company_id = resolved

        result = await extractor.extract(formatted_transcript)
        logger.info(
            "fathom: extraction done recording_id=%s client=%s status=%s",
            recording_id,
            result.client_name,
            result.suggested_status,
        )

        # Merge Fathom metadata into result.raw → stored in extracted_data JSONB (no schema change needed)
        result.raw.update({k: v for k, v in fathom_metadata.items() if v is not None})

        source_metadata = InteractionSourceMetadata(
            source_type="fathom_meet",
            source_message_key=source_key,
        )

        await asyncio.to_thread(
            db.upsert_lead_and_interaction_for_fathom,
            seller_id,
            company_id,
            formatted_transcript,
            result,
            source_metadata,
        )
        logger.info("fathom: saved recording_id=%s", recording_id)

    except Exception as exc:
        logger.error(
            "fathom: processing failed recording_id=%s: %s", recording_id, exc, exc_info=True
        )


# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------

async def _handle_fathom_webhook_test(request: aiohttp.web.Request) -> aiohttp.web.Response:
    """
    Test endpoint — skips HMAC validation. Solo para hackathon, no deployar en prod.
    Acepta el mismo payload que /webhook/fathom.
    """
    logger.warning("fathom/test: processing request WITHOUT signature validation")

    try:
        data = await request.json()
    except json.JSONDecodeError as exc:
        return aiohttp.web.Response(status=400, text=f"Invalid JSON: {exc}")

    recording_id, formatted_transcript, fathom_metadata = _parse_fathom_payload(data)
    source_key = f"fathom:{recording_id}"
    logger.info("fathom/test: received recording_id=%s", recording_id)

    try:
        existing = await asyncio.to_thread(db.get_interaction_by_source_message_key, source_key)
    except Exception as exc:
        logger.error("fathom/test: dedup check failed: %s", exc)
        existing = None

    if existing:
        return aiohttp.web.Response(status=200, text=f"Already processed: {existing.get('id')}")

    asyncio.create_task(_process_fathom_recording(recording_id, source_key, formatted_transcript, fathom_metadata))
    return aiohttp.web.Response(status=200, text="Accepted")


async def _handle_fathom_webhook(request: aiohttp.web.Request) -> aiohttp.web.Response:
    # Read raw body first — must happen before JSON parsing for HMAC validation
    body = await request.read()

    if not FATHOM_WEBHOOK_SECRET:
        logger.error("fathom: FATHOM_WEBHOOK_SECRET not configured — rejecting webhook")
        return aiohttp.web.Response(status=401, text="Webhook secret not configured")

    webhook_id = request.headers.get("webhook-id", "")
    webhook_timestamp = request.headers.get("webhook-timestamp", "")
    webhook_signature = request.headers.get("webhook-signature", "")

    if not all([webhook_id, webhook_timestamp, webhook_signature]):
        logger.warning("fathom: missing SVix headers")
        return aiohttp.web.Response(status=400, text="Missing webhook headers")

    if not _verify_svix_signature(body, webhook_id, webhook_timestamp, webhook_signature, FATHOM_WEBHOOK_SECRET):
        logger.warning("fathom: signature validation failed webhook-id=%s", webhook_id)
        return aiohttp.web.Response(status=401, text="Invalid signature")

    try:
        data = json.loads(body)
    except json.JSONDecodeError as exc:
        logger.warning("fathom: invalid JSON: %s", exc)
        return aiohttp.web.Response(status=400, text="Invalid JSON")

    recording_id, formatted_transcript, fathom_metadata = _parse_fathom_payload(data)
    source_key = f"fathom:{recording_id}"
    logger.info("fathom: received webhook recording_id=%s event=%s", recording_id, fathom_metadata.get("fathom_event_type"))

    # Deduplicate before doing any work
    try:
        existing = await asyncio.to_thread(db.get_interaction_by_source_message_key, source_key)
    except Exception as exc:
        logger.error("fathom: dedup check failed: %s", exc)
        existing = None

    if existing:
        logger.info("fathom: duplicate recording_id=%s interaction_id=%s", recording_id, existing.get("id"))
        return aiohttp.web.Response(status=200, text="Already processed")

    # Return 200 immediately — Fathom/SVix retries if no response within ~15s
    # OpenAI extraction can take 5-15s for long transcripts
    asyncio.create_task(_process_fathom_recording(recording_id, source_key, formatted_transcript, fathom_metadata))
    return aiohttp.web.Response(status=200, text="Accepted")


# ---------------------------------------------------------------------------
# Server factory — called from main.py
# ---------------------------------------------------------------------------

async def create_server(port: int) -> tuple[aiohttp.web.AppRunner, aiohttp.web.TCPSite]:
    app = aiohttp.web.Application()
    app.router.add_post("/webhook/fathom", _handle_fathom_webhook)
    app.router.add_post("/webhook/fathom/test", _handle_fathom_webhook_test)
    runner = aiohttp.web.AppRunner(app)
    await runner.setup()
    site = aiohttp.web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    logger.info("fathom webhook server listening on 0.0.0.0:%d", port)
    return runner, site
