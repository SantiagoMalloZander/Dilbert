import asyncio
import logging
from typing import Optional
from telegram import Update
from telegram.ext import ApplicationBuilder, MessageHandler, CommandHandler, filters, ContextTypes

import buffer as buf
import extractor
import db
import intake
import proactive
import transcription
from config import (
    TELEGRAM_BOT_TOKEN,
    BUFFER_TIMEOUT_SECONDS,
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
)
from observability import log_stage

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    level=logging.INFO,
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

# telegram_user_id (int) → seller row from Supabase
# Loaded once at startup; empty dict means "no DB configured".
_seller_cache: dict[int, dict] = {}


async def _load_seller_cache() -> None:
    """Populate _seller_cache from the sellers table. Called once at bot startup."""
    global _seller_cache
    if not SUPABASE_URL:
        logger.warning("SUPABASE_URL not set — seller cache disabled, all humans treated as sellers")
        return
    try:
        sellers = await asyncio.to_thread(db.get_all_sellers)
        _seller_cache = {int(s["telegram_user_id"]): s for s in sellers}
        logger.info("seller cache loaded: %d sellers %s", len(_seller_cache), list(_seller_cache.keys()))
    except Exception as e:
        logger.error("failed to load seller cache: %s", e)


def _is_seller(telegram_user_id: int) -> bool:
    """True if this Telegram user is a registered seller.
    Falls back to True for all humans when the cache is empty (no DB configured)."""
    if not _seller_cache:
        return True  # fallback: no DB, allow any human
    return telegram_user_id in _seller_cache


def _cache_seller(seller: Optional[dict]) -> None:
    if not seller:
        return
    try:
        _seller_cache[int(seller["telegram_user_id"])] = seller
    except (KeyError, TypeError, ValueError):
        logger.warning("could not cache seller=%s", seller)


def _is_private_chat(chat) -> bool:
    return bool(chat and chat.type == "private")


async def _extract_private_message_text(
    msg,
    *,
    chat_id: int,
    message_id: int,
    user_id: int,
    seller_telegram_id: int,
) -> tuple[str, str]:
    if msg.text:
        return msg.text, "text"

    media = msg.voice or msg.audio
    if not media:
        raise ValueError("unsupported_private_message")

    source_type = "voice" if msg.voice else "audio"
    fallback_extension = "ogg" if msg.voice else "bin"
    fallback_filename = f"telegram-{chat_id}-{message_id}.{fallback_extension}"

    log_stage(
        logger,
        "audio_download",
        chat_id=chat_id,
        message_id=message_id,
        user_id=user_id,
        seller_telegram_id=seller_telegram_id,
        source_type=source_type,
    )
    downloaded = await transcription.download_telegram_audio(media, fallback_filename)

    log_stage(
        logger,
        "audio_download",
        chat_id=chat_id,
        message_id=message_id,
        user_id=user_id,
        seller_telegram_id=seller_telegram_id,
        source_type=source_type,
        filename=downloaded.filename,
        file_size=downloaded.file_size,
        mime_type=downloaded.mime_type,
    )

    log_stage(
        logger,
        "transcription",
        chat_id=chat_id,
        message_id=message_id,
        user_id=user_id,
        seller_telegram_id=seller_telegram_id,
        source_type=source_type,
        filename=downloaded.filename,
    )
    text = await transcription.transcribe_audio_bytes(downloaded)
    if msg.caption:
        text = f"{text}\n\nNota adicional del vendedor: {msg.caption.strip()}"

    log_stage(
        logger,
        "transcription",
        chat_id=chat_id,
        message_id=message_id,
        user_id=user_id,
        seller_telegram_id=seller_telegram_id,
        source_type=source_type,
        filename=downloaded.filename,
        chars=len(text),
    )
    return text, source_type


async def _send_outcome_messages(
    chat_id: int,
    context: ContextTypes.DEFAULT_TYPE,
    messages: list[str],
    *,
    message_id: int,
    user_id: int,
    seller_telegram_id: Optional[int],
    source_type: str,
) -> None:
    for text in messages:
        await context.bot.send_message(chat_id=chat_id, text=text)
        log_stage(
            logger,
            "reply",
            chat_id=chat_id,
            message_id=message_id,
            user_id=user_id,
            seller_telegram_id=seller_telegram_id,
            source_type=source_type,
            text_preview=text[:120],
        )


async def _handle_private_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    msg = update.effective_message
    chat = update.effective_chat
    user = update.effective_user

    if not msg or not chat or not user:
        return

    if not (SUPABASE_URL and SUPABASE_SERVICE_KEY):
        await context.bot.send_message(
            chat_id=chat.id,
            text="❌ El CRM no está configurado en este entorno, así que no puedo guardar este mensaje.",
        )
        return

    seller_telegram_id = user.id

    seller_name = user.full_name or user.username or f"Telegram User {seller_telegram_id}"

    try:
        seller, created = await asyncio.to_thread(
            db.ensure_seller_for_telegram_user,
            seller_telegram_id,
            seller_name,
        )
    except Exception as exc:
        logger.error("seller lookup failed: %s", exc)
        await context.bot.send_message(
            chat_id=chat.id,
            text="❌ No pude validar o registrar tu usuario en el CRM en este momento. Probá de nuevo más tarde.",
        )
        return

    _cache_seller(seller)
    if created:
        log_stage(
            logger,
            "seller_autoregistered",
            chat_id=chat.id,
            user_id=user.id,
            seller_telegram_id=seller_telegram_id,
            seller_id=seller["id"],
        )

    pending = proactive.get_pending(chat.id) if proactive.has_pending(chat.id) else None
    canonical_source_key = (
        pending.source_message_key if pending and pending.source_message_key else f"{chat.id}:{msg.message_id}"
    )

    try:
        existing = await asyncio.to_thread(db.get_interaction_by_source_message_key, canonical_source_key)
    except Exception as exc:
        logger.error("duplicate lookup failed: %s", exc)
        existing = None

    if existing:
        proactive.clear_pending(chat.id)
        log_stage(
            logger,
            "duplicate",
            chat_id=chat.id,
            message_id=msg.message_id,
            user_id=user.id,
            seller_telegram_id=seller_telegram_id,
            source_type=pending.source_type if pending and pending.source_type else ("voice" if msg.voice else "audio" if msg.audio else "text"),
            source_message_key=canonical_source_key,
        )
        await context.bot.send_message(
            chat_id=chat.id,
            text="⚠️ Este mensaje ya había sido procesado antes. No lo volví a guardar en el CRM.",
        )
        return

    try:
        extracted_text, source_type = await _extract_private_message_text(
            msg,
            chat_id=chat.id,
            message_id=msg.message_id,
            user_id=user.id,
            seller_telegram_id=seller_telegram_id,
        )
    except transcription.AudioDownloadError as exc:
        log_stage(
            logger,
            "audio_download",
            level="error",
            chat_id=chat.id,
            message_id=msg.message_id,
            user_id=user.id,
            seller_telegram_id=seller_telegram_id,
            source_type="voice" if msg.voice else "audio",
            error=str(exc),
        )
        await context.bot.send_message(
            chat_id=chat.id,
            text="❌ No pude descargar el audio de Telegram. Reenviámelo o probá con texto.",
        )
        return
    except transcription.AudioTranscriptionError as exc:
        log_stage(
            logger,
            "transcription",
            level="error",
            chat_id=chat.id,
            message_id=msg.message_id,
            user_id=user.id,
            seller_telegram_id=seller_telegram_id,
            source_type="voice" if msg.voice else "audio",
            error=str(exc),
        )
        await context.bot.send_message(
            chat_id=chat.id,
            text="❌ No pude procesar el audio en este momento. Probá de nuevo o mandamelo por texto.",
        )
        return
    except ValueError:
        await context.bot.send_message(
            chat_id=chat.id,
            text="❌ Este tipo de mensaje no está soportado para la carga directa al CRM.",
        )
        return

    if pending:
        transcript = proactive.build_enriched_transcript(chat.id, extracted_text)
        await context.bot.send_message(
            chat_id=chat.id,
            text="🔄 Gracias, re-analizando con tu aclaración...",
        )
        source_context = intake.PrivateMessageContext(
            chat_id=pending.source_chat_id or chat.id,
            message_id=pending.source_message_id or msg.message_id,
            user_id=pending.source_user_id or user.id,
            sender_name=user.full_name,
            seller_telegram_id=pending.seller_telegram_id or seller_telegram_id,
            source_type=pending.source_type or source_type,
            source_message_key=canonical_source_key,
        )
    else:
        transcript = intake.build_direct_transcript(
            extracted_text,
            sender_name=user.full_name,
            source_type=source_type,
        )
        source_context = intake.PrivateMessageContext(
            chat_id=chat.id,
            message_id=msg.message_id,
            user_id=user.id,
            sender_name=user.full_name,
            seller_telegram_id=seller_telegram_id,
            source_type=source_type,
            source_message_key=canonical_source_key,
        )
        await context.bot.send_message(
            chat_id=chat.id,
            text="🔍 Procesando tu mensaje para cargarlo al CRM...",
        )

    try:
        outcome = await intake.process_private_transcript(transcript, source_context)
    except Exception as exc:
        log_stage(
            logger,
            "crm_write",
            level="error",
            chat_id=source_context.chat_id,
            message_id=source_context.message_id,
            user_id=source_context.user_id,
            seller_telegram_id=source_context.seller_telegram_id,
            source_type=source_context.source_type,
            source_message_key=source_context.source_message_key,
            error=str(exc),
        )
        await context.bot.send_message(
            chat_id=chat.id,
            text="❌ Ocurrió un error inesperado mientras procesaba el mensaje. No se guardó nada en el CRM.",
        )
        return

    await _send_outcome_messages(
        chat.id,
        context,
        outcome.messages,
        message_id=source_context.message_id,
        user_id=source_context.user_id,
        seller_telegram_id=source_context.seller_telegram_id,
        source_type=source_context.source_type,
    )


async def _trigger_analysis(
    chat_id: int,
    context: ContextTypes.DEFAULT_TYPE,
    seller_telegram_id: Optional[int] = None,
    transcript: Optional[str] = None,
) -> None:
    """Called when buffer is ready to be analyzed (timeout or count reached)."""
    if transcript is None:
        messages = buf.flush(chat_id)
        if not messages:
            return
        transcript = buf.format_for_llm(messages)
    logger.info("ANÁLISIS TRIGGERED chat=%s\n%s", chat_id, transcript)

    await context.bot.send_message(chat_id=chat_id, text="🔍 Analizando conversación...")

    try:
        result = await extractor.extract(transcript)
    except Exception as e:
        logger.error("extractor failed: %s", e)
        await context.bot.send_message(chat_id=chat_id, text=f"❌ Error al analizar: {e}")
        return

    # Write to Supabase if configured
    lead = None
    if SUPABASE_URL and seller_telegram_id:
        try:
            lead = db.upsert_lead_and_interaction(seller_telegram_id, transcript, result)
        except Exception as e:
            logger.error("db write failed: %s", e)

    # Build confirmation message
    amount_str = f"{result.estimated_amount:,} {result.currency}" if result.estimated_amount else "monto no detectado"
    client_str = f"{result.client_name or '?'}" + (f" de {result.client_company}" if result.client_company else "")
    db_status = "💾 Guardado en CRM" if lead else ("⚠️ Vendedor no registrado en CRM" if SUPABASE_URL else "")

    await context.bot.send_message(
        chat_id=chat_id,
        text=(
            f"✅ Extracción completada\n"
            f"👤 Cliente: {client_str}\n"
            f"💰 Monto: {amount_str}\n"
            f"📦 Producto: {result.product_interest or 'no detectado'}\n"
            f"😶 Sentimiento: {result.sentiment}\n"
            f"📋 Status: {result.suggested_status}\n"
            f"📝 Resumen: {result.summary}"
            + (f"\n{db_status}" if db_status else "")
        ),
    )

    if result.ambiguities:
        proactive.set_pending(
            chat_id=chat_id,
            previous_transcript=transcript,
            seller_telegram_id=seller_telegram_id,
            questions=result.ambiguities,
        )
        for ambiguity in result.ambiguities:
            await context.bot.send_message(
                chat_id=chat_id,
                text=f"🤖 Detecté información nueva pero tengo una duda: {ambiguity}. ¿Podés confirmar?",
            )
    else:
        proactive.clear_pending(chat_id)


async def _schedule_timeout(chat_id: int, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Wait BUFFER_TIMEOUT_SECONDS then trigger analysis if still no new messages."""
    await asyncio.sleep(BUFFER_TIMEOUT_SECONDS)
    logger.info("timeout reached chat=%s — triggering analysis", chat_id)
    chat_buffer = buf.get_or_create(chat_id)
    await _trigger_analysis(chat_id, context, seller_telegram_id=chat_buffer.seller_telegram_id)


async def on_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    msg = update.effective_message
    chat = update.effective_chat
    user = update.effective_user

    if not msg or not chat or not user:
        return

    if _is_private_chat(chat):
        await _handle_private_message(update, context)
        return

    if not msg.text:
        return

    is_seller = _is_seller(user.id)

    # If the bot asked a clarification and this is the seller's reply, resolve it
    if is_seller and proactive.has_pending(chat.id):
        enriched = proactive.build_enriched_transcript(chat.id, msg.text)
        pending = proactive.get_pending(chat.id)
        proactive.clear_pending(chat.id)
        logger.info("clarification received chat=%s — re-analyzing with context", chat.id)
        await context.bot.send_message(chat.id, "🔄 Gracias, re-analizando con tu aclaración...")
        await _trigger_analysis(
            chat.id,
            context,
            seller_telegram_id=pending.seller_telegram_id,
            transcript=enriched,
        )
        return

    chat_buffer = buf.add_message(
        chat_id=chat.id,
        text=msg.text,
        sender_name=user.full_name,
        sender_id=user.id,
        is_seller=is_seller,
    )

    # Track the first seller seen in this chat so analysis can be attributed correctly
    if is_seller and chat_buffer.seller_telegram_id is None:
        chat_buffer.seller_telegram_id = user.id
        logger.info("seller identified in chat=%s: telegram_id=%s", chat.id, user.id)

    # Reset inactivity timeout
    if chat_buffer.timeout_task and not chat_buffer.timeout_task.done():
        chat_buffer.timeout_task.cancel()
    chat_buffer.timeout_task = asyncio.create_task(
        _schedule_timeout(chat.id, context)
    )

    # Trigger immediately if message count threshold reached
    if buf.should_trigger_by_count(chat.id):
        if chat_buffer.timeout_task and not chat_buffer.timeout_task.done():
            chat_buffer.timeout_task.cancel()
        await _trigger_analysis(chat.id, context, seller_telegram_id=chat_buffer.seller_telegram_id)


async def cmd_analizar(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    if buf.message_count(chat_id) == 0:
        await update.message.reply_text("No hay mensajes acumulados para analizar.")
        return
    chat_buffer = buf.get_or_create(chat_id)
    # Prefer the seller already identified in the buffer; fall back to whoever ran the command
    # (if it's a seller) so that /analizar from the seller still works correctly.
    seller_id = chat_buffer.seller_telegram_id
    if seller_id is None and update.effective_user and _is_seller(update.effective_user.id):
        seller_id = update.effective_user.id
    await _trigger_analysis(chat_id, context, seller_telegram_id=seller_id)


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    user = update.effective_user
    count = buf.message_count(chat_id)
    await update.message.reply_text(
        f"🤖 Bot activo\n📨 Mensajes en buffer: {count}\n⏱ Timeout: {BUFFER_TIMEOUT_SECONDS}s\n🪪 Tu Telegram ID: {user.id}"
    )


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat = update.effective_chat
    user = update.effective_user
    if not chat or not user:
        return

    if not _is_private_chat(chat):
        await update.message.reply_text("Escribime por privado y te registro automáticamente.")
        return

    if not (SUPABASE_URL and SUPABASE_SERVICE_KEY):
        await update.message.reply_text(
            "🤖 Bot activo, pero el CRM no está configurado en este entorno."
        )
        return

    seller_name = user.full_name or user.username or f"Telegram User {user.id}"
    try:
        seller, created = await asyncio.to_thread(
            db.ensure_seller_for_telegram_user,
            user.id,
            seller_name,
        )
    except Exception as exc:
        logger.error("start registration failed: %s", exc)
        await update.message.reply_text(
            "❌ No pude registrarte automáticamente en el CRM. Probá de nuevo más tarde."
        )
        return

    _cache_seller(seller)
    if created:
        await update.message.reply_text(
            "✅ Te registré automáticamente como vendedor. Ya podés mandarme texto o audio y lo cargo al CRM."
        )
    else:
        await update.message.reply_text(
            "✅ Ya estabas registrado. Mandame texto o audio por este chat y lo cargo al CRM."
        )


async def post_init(app) -> None:
    """Load seller cache once the event loop is running."""
    await _load_seller_cache()


async def post_shutdown(app) -> None:
    """Cancel any pending timeout tasks on clean shutdown."""
    buf.cancel_all_timeouts()


def main() -> None:
    app = (
        ApplicationBuilder()
        .token(TELEGRAM_BOT_TOKEN)
        .post_init(post_init)
        .post_shutdown(post_shutdown)
        .build()
    )

    app.add_handler(
        MessageHandler((filters.TEXT | filters.VOICE | filters.AUDIO) & ~filters.COMMAND, on_message)
    )
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("analizar", cmd_analizar))
    app.add_handler(CommandHandler("status", cmd_status))

    logger.info("Bot iniciado. Esperando mensajes...")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
