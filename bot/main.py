import asyncio
import logging
import signal
from typing import Optional
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import (
    ApplicationBuilder,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

import buffer as buf
import db
import fathom_webhook
import intake
import proactive
import review_queue
import transcription
from config import (
    TELEGRAM_BOT_TOKEN,
    BUFFER_TIMEOUT_SECONDS,
    BUFFER_SHORT_TIMEOUT_SECONDS,
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    PORT,
)
from observability import log_stage

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    level=logging.INFO,
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

GROUP_REVIEW_PREVIEW_CHARS = 700

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


def _review_keyboard(review_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [[
            InlineKeyboardButton("Analizar", callback_data=f"review:analyze:{review_id}"),
            InlineKeyboardButton("Descartar", callback_data=f"review:discard:{review_id}"),
        ]]
    )


def _trim_transcript_preview(transcript: str, limit: int = GROUP_REVIEW_PREVIEW_CHARS) -> str:
    if len(transcript) <= limit:
        return transcript
    return transcript[: limit - 3].rstrip() + "..."


def _build_review_message(review: review_queue.PendingGroupReview) -> str:
    created_at = review.created_at.strftime("%H:%M")
    return (
        f"📥 Conversación pendiente {review.review_id}\n"
        f"💬 Chat: {review.source_chat_title}\n"
        f"🕒 Detectada: {created_at}\n\n"
        f"{_trim_transcript_preview(review.transcript)}\n\n"
        f"Podés analizarla con el botón o con /analizar {review.review_id}."
    )


async def _notify_pending_review(
    review: review_queue.PendingGroupReview,
    context: ContextTypes.DEFAULT_TYPE,
) -> None:
    for seller_telegram_id in review.allowed_seller_telegram_ids:
        try:
            await context.bot.send_message(
                chat_id=seller_telegram_id,
                text=_build_review_message(review),
                reply_markup=_review_keyboard(review.review_id),
            )
        except Exception as exc:
            logger.warning(
                "could not notify seller=%s about pending review=%s: %s",
                seller_telegram_id,
                review.review_id,
                exc,
            )


async def _enqueue_group_review(
    chat_id: int,
    context: ContextTypes.DEFAULT_TYPE,
    seller_telegram_id: Optional[int],
) -> None:
    chat_buffer = buf.get_or_create(chat_id)
    messages = buf.flush(chat_id)
    if not messages:
        return

    seller_ids = [message.sender_id for message in messages if message.is_seller]
    if seller_telegram_id and seller_telegram_id not in seller_ids:
        seller_ids.append(seller_telegram_id)

    if not seller_ids:
        logger.info("dropping buffered chat=%s because no seller was identified", chat_id)
        return

    transcript = buf.format_for_llm(messages)
    last_message = messages[-1]
    review = review_queue.enqueue_review(
        allowed_seller_telegram_ids=seller_ids,
        source_chat_id=chat_id,
        source_chat_title=chat_buffer.chat_title,
        transcript=transcript,
        last_message_id=last_message.message_id,
        last_sender_id=last_message.sender_id,
    )
    logger.info(
        "queued group review=%s chat=%s sellers=%s",
        review.review_id,
        chat_id,
        review.allowed_seller_telegram_ids,
    )
    await _notify_pending_review(review, context)


async def _run_pending_review(
    review: review_queue.PendingGroupReview,
    *,
    private_chat_id: int,
    control_message_id: int,
    seller_user_id: int,
    seller_name: str,
    context: ContextTypes.DEFAULT_TYPE,
) -> bool:
    await context.bot.send_message(
        chat_id=private_chat_id,
        text=f"🔍 Analizando {review.review_id} de {review.source_chat_title}...",
    )

    source_context = intake.PrivateMessageContext(
        chat_id=private_chat_id,
        message_id=control_message_id,
        user_id=seller_user_id,
        sender_name=seller_name,
        seller_telegram_id=seller_user_id,
        source_type="group_chat",
        source_message_key=review.source_message_key,
        source_chat_id=review.source_chat_id,
        source_message_id=review.last_message_id,
        source_user_id=review.last_sender_id,
    )

    try:
        outcome = await intake.process_private_transcript(review.transcript, source_context)
    except Exception as exc:
        log_stage(
            logger,
            "crm_write",
            level="error",
            chat_id=private_chat_id,
            message_id=control_message_id,
            user_id=seller_user_id,
            seller_telegram_id=seller_user_id,
            source_type="group_chat",
            source_message_key=review.source_message_key,
            error=str(exc),
        )
        await context.bot.send_message(
            chat_id=private_chat_id,
            text="❌ Ocurrió un error inesperado mientras procesaba la conversación. No se guardó nada en el CRM.",
        )
        return False

    await _send_outcome_messages(
        private_chat_id,
        context,
        outcome.messages,
        message_id=control_message_id,
        user_id=seller_user_id,
        seller_telegram_id=seller_user_id,
        source_type="group_chat",
    )
    review_queue.pop_review(review.review_id)
    return True


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
            chat_id=chat.id,
            message_id=msg.message_id,
            user_id=user.id,
            sender_name=user.full_name,
            seller_telegram_id=pending.seller_telegram_id or seller_telegram_id,
            source_type=pending.source_type or source_type,
            source_message_key=canonical_source_key,
            source_chat_id=pending.source_chat_id,
            source_message_id=pending.source_message_id,
            source_user_id=pending.source_user_id,
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


async def _auto_analyze_conversation(
    chat_id: int,
    context: ContextTypes.DEFAULT_TYPE,
    seller_telegram_id: Optional[int],
) -> None:
    """Flush del buffer + análisis completo automático sin intervención del vendedor."""
    chat_buffer = buf.get_or_create(chat_id)
    messages = buf.flush(chat_id)
    if not messages:
        return

    seller_ids = [m.sender_id for m in messages if m.is_seller]
    if seller_telegram_id and seller_telegram_id not in seller_ids:
        seller_ids.append(seller_telegram_id)

    if not seller_ids:
        logger.info("auto-analyze: no seller in chat=%s, dropping", chat_id)
        return

    transcript = buf.format_for_llm(messages)
    last_message = messages[-1]

    review = review_queue.enqueue_review(
        allowed_seller_telegram_ids=seller_ids,
        source_chat_id=chat_id,
        source_chat_title=chat_buffer.chat_title,
        transcript=transcript,
        last_message_id=last_message.message_id,
        last_sender_id=last_message.sender_id,
    )

    primary_seller_id = seller_ids[0]
    seller_row = _seller_cache.get(primary_seller_id, {})
    seller_name = seller_row.get("name", f"Vendedor {primary_seller_id}")

    logger.info(
        "auto-analyze: running review=%s chat=%s seller=%s",
        review.review_id, chat_id, primary_seller_id,
    )

    await _run_pending_review(
        review,
        private_chat_id=primary_seller_id,
        control_message_id=0,
        seller_user_id=primary_seller_id,
        seller_name=seller_name,
        context=context,
    )


async def _schedule_timeout(chat_id: int, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Wait for inactivity timeout then auto-analyze the conversation."""
    chat_buffer = buf.get_or_create(chat_id)
    timeout = BUFFER_SHORT_TIMEOUT_SECONDS if chat_buffer.use_short_timeout else BUFFER_TIMEOUT_SECONDS
    await asyncio.sleep(timeout)
    logger.info("timeout reached chat=%s short=%s — auto-analyzing", chat_id, chat_buffer.use_short_timeout)
    chat_buffer = buf.get_or_create(chat_id)
    await _auto_analyze_conversation(chat_id, context, seller_telegram_id=chat_buffer.seller_telegram_id)


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

    chat_buffer = buf.add_message(
        chat_id=chat.id,
        chat_title=chat.title,
        text=msg.text,
        sender_name=user.full_name,
        sender_id=user.id,
        message_id=msg.message_id,
        is_seller=is_seller,
    )

    # Track the first seller seen in this chat so analysis can be attributed correctly
    if is_seller and chat_buffer.seller_telegram_id is None:
        chat_buffer.seller_telegram_id = user.id
        logger.info("seller identified in chat=%s: telegram_id=%s", chat.id, user.id)

    # Detectar frase de cierre → activar timeout corto
    if msg.text and buf.detect_farewell(msg.text):
        chat_buffer.use_short_timeout = True
        logger.info("farewell detected chat=%s — short timeout active", chat.id)

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
        await _enqueue_group_review(chat.id, context, seller_telegram_id=chat_buffer.seller_telegram_id)


async def cmd_analizar(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat = update.effective_chat
    user = update.effective_user
    msg = update.effective_message

    if not chat or not user or not msg:
        return

    if not _is_private_chat(chat):
        await update.message.reply_text("Usá /analizar por privado. Si querés ver la cola, mandame /pendientes.")
        return

    review_id = context.args[0].upper() if context.args else None
    review = (
        review_queue.get_review(review_id)
        if review_id
        else review_queue.peek_next_review(user.id)
    )

    if not review or user.id not in review.allowed_seller_telegram_ids:
        await update.message.reply_text("No tengo conversaciones pendientes para analizar.")
        return

    await _run_pending_review(
        review,
        private_chat_id=chat.id,
        control_message_id=msg.message_id,
        seller_user_id=user.id,
        seller_name=user.full_name or user.username or f"Telegram User {user.id}",
        context=context,
    )


async def cmd_pendientes(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat = update.effective_chat
    user = update.effective_user

    if not chat or not user:
        return

    if not _is_private_chat(chat):
        await update.message.reply_text("Escribime por privado y te muestro las conversaciones pendientes.")
        return

    reviews = review_queue.list_reviews_for_seller(user.id)
    if not reviews:
        await update.message.reply_text("No tengo conversaciones pendientes para revisar.")
        return

    await update.message.reply_text(
        f"Tengo {len(reviews)} conversación{'es' if len(reviews) != 1 else ''} pendiente{'s' if len(reviews) != 1 else ''}."
    )
    for review in reviews:
        await context.bot.send_message(
            chat_id=chat.id,
            text=_build_review_message(review),
            reply_markup=_review_keyboard(review.review_id),
        )


async def on_review_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    user = update.effective_user
    chat = update.effective_chat

    if not query or not user or not chat or not _is_private_chat(chat):
        return

    await query.answer()

    try:
        _, action, review_id = (query.data or "").split(":", 2)
    except ValueError:
        return

    review = review_queue.get_review(review_id)
    if not review or user.id not in review.allowed_seller_telegram_ids:
        await context.bot.send_message(
            chat_id=chat.id,
            text="Esa conversación ya no está disponible.",
        )
        return

    if query.message:
        try:
            await query.edit_message_reply_markup(reply_markup=None)
        except Exception:
            logger.debug("could not clear review keyboard for %s", review_id)

    if action == "discard":
        review_queue.pop_review(review_id)
        await context.bot.send_message(
            chat_id=chat.id,
            text=f"🗑️ Descarté {review.review_id} de {review.source_chat_title}.",
        )
        return

    if action != "analyze":
        return

    control_message_id = query.message.message_id if query.message else 0
    await _run_pending_review(
        review,
        private_chat_id=chat.id,
        control_message_id=control_message_id,
        seller_user_id=user.id,
        seller_name=user.full_name or user.username or f"Telegram User {user.id}",
        context=context,
    )


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat = update.effective_chat
    user = update.effective_user

    if not chat or not user:
        return

    count = buf.message_count(chat.id)
    pending_reviews = len(review_queue.list_reviews_for_seller(user.id)) if _is_private_chat(chat) else 0
    await update.message.reply_text(
        f"🤖 Bot activo\n📨 Mensajes en buffer: {count}\n🗂 Revisiones pendientes: {pending_reviews}\n⏱ Timeout: {BUFFER_TIMEOUT_SECONDS}s\n🪪 Tu Telegram ID: {user.id}"
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
            "✅ Te registré automáticamente como vendedor. Ya podés mandarme texto o audio, y también te voy a avisar por acá cuando haya conversaciones listas para revisar."
        )
    else:
        await update.message.reply_text(
            "✅ Ya estabas registrado. Mandame texto o audio por este chat y usá /pendientes para ver conversaciones grupales listas para revisar."
        )


async def post_init(app) -> None:
    """Load seller cache once the event loop is running."""
    await _load_seller_cache()


async def post_shutdown(app) -> None:
    """Cancel any pending timeout tasks on clean shutdown."""
    buf.cancel_all_timeouts()
    review_queue.clear_all()


async def _run(app) -> None:
    """
    Runs the Telegram bot and Fathom webhook HTTP server on the same asyncio event loop.
    Uses the PTB v21 lower-level async API instead of the blocking run_polling().
    """
    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stop_event.set)

    webhook_runner = None
    async with app:  # triggers post_init on enter, post_shutdown on exit
        await app.start()
        await app.updater.start_polling(drop_pending_updates=True)
        logger.info("Bot iniciado. Esperando mensajes...")

        try:
            webhook_runner, _site = await fathom_webhook.create_server(PORT)
        except Exception as exc:
            logger.error("Failed to start Fathom webhook server on port %d: %s", PORT, exc)
            # Telegram bot continues working even if webhook server fails to start

        await stop_event.wait()
        logger.info("Shutdown signal received — stopping...")

        await app.updater.stop()
        await app.stop()

    if webhook_runner:
        await webhook_runner.cleanup()


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
    app.add_handler(CallbackQueryHandler(on_review_callback, pattern=r"^review:"))
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("analizar", cmd_analizar))
    app.add_handler(CommandHandler("pendientes", cmd_pendientes))
    app.add_handler(CommandHandler("status", cmd_status))

    asyncio.run(_run(app))


if __name__ == "__main__":
    main()
