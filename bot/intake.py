import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

import db
import extractor
import proactive
from db import InteractionSourceMetadata
from observability import log_stage
from validation import ValidationResult, validate_extraction_result

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PrivateMessageContext:
    chat_id: int
    message_id: int
    user_id: int
    sender_name: str
    seller_telegram_id: int
    source_type: str
    source_message_key: str
    source_chat_id: Optional[int] = None
    source_message_id: Optional[int] = None
    source_user_id: Optional[int] = None

    def as_source_metadata(self) -> InteractionSourceMetadata:
        return InteractionSourceMetadata(
            source_type=self.source_type,
            source_chat_id=self.source_chat_id if self.source_chat_id is not None else self.chat_id,
            source_message_id=self.source_message_id if self.source_message_id is not None else self.message_id,
            source_user_id=self.source_user_id if self.source_user_id is not None else self.user_id,
            source_message_key=self.source_message_key,
        )


@dataclass
class ProcessingOutcome:
    messages: list[str]
    saved: bool = False
    duplicate: bool = False
    needs_clarification: bool = False
    lead: Optional[dict] = None
    extraction_result: Optional[extractor.ExtractionResult] = None


def build_direct_transcript(
    text: str,
    *,
    sender_name: str,
    source_type: str,
    timestamp: Optional[datetime] = None,
) -> str:
    ts = (timestamp or datetime.now(timezone.utc)).strftime("%H:%M")
    source_label = "AUDIO" if source_type in {"voice", "audio"} else "NOTA"
    return f"[{ts}] VENDEDOR ({sender_name}) [{source_label} DIRECTA AL CRM]: {text.strip()}"


def _format_amount(result: extractor.ExtractionResult) -> str:
    if result.estimated_amount is None:
        return "monto no detectado"
    currency = result.currency or "moneda no detectada"
    return f"{result.estimated_amount:,} {currency}"


def _format_client(result: extractor.ExtractionResult) -> str:
    client = result.client_name or "no detectado"
    if result.client_company:
        return f"{client} de {result.client_company}"
    return client


def _build_understood_message(result: extractor.ExtractionResult, *, saved: bool) -> str:
    header = "✅ Guardado en CRM" if saved else "⚠️ Entendí esto pero no lo guardé"
    return (
        f"{header}\n"
        f"👤 Cliente: {_format_client(result)}\n"
        f"💰 Monto: {_format_amount(result)}\n"
        f"📦 Producto: {result.product_interest or 'no detectado'}\n"
        f"😶 Sentimiento: {result.sentiment}\n"
        f"📋 Status: {result.suggested_status}\n"
        f"📝 Resumen: {result.summary or 'sin resumen'}"
    )


def _build_validation_message(
    result: extractor.ExtractionResult,
    validation: ValidationResult,
) -> str:
    details = []
    if validation.missing_fields:
        details.append(
            "Faltan datos obligatorios: " + ", ".join(validation.missing_fields) + "."
        )
    if validation.ambiguity_messages:
        details.append(
            "Hay ambigüedades que necesito confirmar antes de guardarlo."
        )
    if validation.contract_errors:
        details.append(
            "Encontré incompatibilidades con el contrato actual del CRM."
        )
    return _build_understood_message(result, saved=False) + "\n\n" + "\n".join(details)


async def process_private_transcript(
    transcript: str,
    context: PrivateMessageContext,
) -> ProcessingOutcome:
    log_stage(
        logger,
        "received",
        chat_id=context.chat_id,
        message_id=context.message_id,
        user_id=context.user_id,
        seller_telegram_id=context.seller_telegram_id,
        source_type=context.source_type,
        source_message_key=context.source_message_key,
    )

    existing = db.get_interaction_by_source_message_key(context.source_message_key)
    if existing:
        log_stage(
            logger,
            "duplicate",
            chat_id=context.chat_id,
            message_id=context.message_id,
            user_id=context.user_id,
            seller_telegram_id=context.seller_telegram_id,
            source_type=context.source_type,
            source_message_key=context.source_message_key,
        )
        return ProcessingOutcome(
            messages=[
                "⚠️ Este mensaje ya había sido procesado antes. No lo volví a guardar en el CRM."
            ],
            duplicate=True,
        )

    result = await extractor.extract(transcript)
    log_stage(
        logger,
        "extraction",
        chat_id=context.chat_id,
        message_id=context.message_id,
        user_id=context.user_id,
        seller_telegram_id=context.seller_telegram_id,
        source_type=context.source_type,
        source_message_key=context.source_message_key,
        client_name=result.client_name,
        client_company=result.client_company,
        product_interest=result.product_interest,
        estimated_amount=result.estimated_amount,
        currency=result.currency,
        sentiment=result.sentiment,
        suggested_status=result.suggested_status,
    )

    seller = db.get_seller_by_telegram_id(context.seller_telegram_id)
    if not seller:
        log_stage(
            logger,
            "validation",
            level="warning",
            chat_id=context.chat_id,
            message_id=context.message_id,
            user_id=context.user_id,
            seller_telegram_id=context.seller_telegram_id,
            source_type=context.source_type,
            source_message_key=context.source_message_key,
            error="seller_not_found",
        )
        return ProcessingOutcome(
            messages=[
                "❌ No pude asociarte con un vendedor registrado en el CRM, así que no guardé nada."
            ],
            extraction_result=result,
        )

    lead_match_count = None
    if result.client_name:
        lead_match_count = len(
            db.find_lead_candidates(seller["id"], result.client_name, result.client_company)
        )
        log_stage(
            logger,
            "lead_resolve",
            chat_id=context.chat_id,
            message_id=context.message_id,
            user_id=context.user_id,
            seller_telegram_id=context.seller_telegram_id,
            source_type=context.source_type,
            source_message_key=context.source_message_key,
            lead_match_count=lead_match_count,
        )

    validation = validate_extraction_result(result, lead_match_count=lead_match_count)
    log_stage(
        logger,
        "validation",
        chat_id=context.chat_id,
        message_id=context.message_id,
        user_id=context.user_id,
        seller_telegram_id=context.seller_telegram_id,
        source_type=context.source_type,
        source_message_key=context.source_message_key,
        can_write=validation.can_write,
        missing_fields=validation.missing_fields,
        ambiguity_messages=validation.ambiguity_messages,
        contract_errors=validation.contract_errors,
    )

    if not validation.can_write:
        source_metadata = context.as_source_metadata()
        proactive.set_pending(
            chat_id=context.chat_id,
            previous_transcript=transcript,
            seller_telegram_id=context.seller_telegram_id,
            questions=validation.questions,
            source_type=context.source_type,
            source_chat_id=source_metadata.source_chat_id,
            source_message_id=source_metadata.source_message_id,
            source_user_id=source_metadata.source_user_id,
            source_message_key=context.source_message_key,
        )
        messages = [_build_validation_message(result, validation)]
        messages.extend(f"🤖 {question}" for question in validation.questions)
        return ProcessingOutcome(
            messages=messages,
            needs_clarification=True,
            extraction_result=result,
        )

    try:
        lead = db.upsert_lead_and_interaction(
            context.seller_telegram_id,
            transcript,
            result,
            source_metadata=context.as_source_metadata(),
        )
    except Exception as exc:
        log_stage(
            logger,
            "crm_write",
            level="error",
            chat_id=context.chat_id,
            message_id=context.message_id,
            user_id=context.user_id,
            seller_telegram_id=context.seller_telegram_id,
            source_type=context.source_type,
            source_message_key=context.source_message_key,
            error=str(exc),
        )
        return ProcessingOutcome(
            messages=[
                _build_understood_message(result, saved=False),
                f"❌ No pude guardarlo en el CRM. No se registró ningún cambio. Detalle técnico: {exc}",
            ],
            extraction_result=result,
        )

    if not lead:
        log_stage(
            logger,
            "crm_write",
            level="warning",
            chat_id=context.chat_id,
            message_id=context.message_id,
            user_id=context.user_id,
            seller_telegram_id=context.seller_telegram_id,
            source_type=context.source_type,
            source_message_key=context.source_message_key,
            error="seller_not_found_during_write",
        )
        return ProcessingOutcome(
            messages=[
                _build_understood_message(result, saved=False),
                "❌ No pude guardarlo en el CRM porque el vendedor no quedó resuelto al momento de persistir.",
            ],
            extraction_result=result,
        )

    proactive.clear_pending(context.chat_id)
    log_stage(
        logger,
        "crm_write",
        chat_id=context.chat_id,
        message_id=context.message_id,
        user_id=context.user_id,
        seller_telegram_id=context.seller_telegram_id,
        source_type=context.source_type,
        source_message_key=context.source_message_key,
        lead_id=lead["id"],
        saved=True,
    )
    return ProcessingOutcome(
        messages=[_build_understood_message(result, saved=True)],
        saved=True,
        lead=lead,
        extraction_result=result,
    )
