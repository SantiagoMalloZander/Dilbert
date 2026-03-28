import asyncio
import logging
from typing import Optional
from telegram import Update
from telegram.ext import ApplicationBuilder, MessageHandler, CommandHandler, filters, ContextTypes

import buffer as buf
import extractor
import db
import proactive
from config import TELEGRAM_BOT_TOKEN, BUFFER_TIMEOUT_SECONDS, SUPABASE_URL

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    level=logging.INFO,
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)


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


async def _schedule_timeout(chat_id: int, seller_id: int, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Wait BUFFER_TIMEOUT_SECONDS then trigger analysis if still no new messages."""
    await asyncio.sleep(BUFFER_TIMEOUT_SECONDS)
    logger.info("timeout reached chat=%s — triggering analysis", chat_id)
    await _trigger_analysis(chat_id, context, seller_telegram_id=seller_id)


async def on_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    msg = update.effective_message
    chat = update.effective_chat
    user = update.effective_user

    if not msg or not msg.text or not user:
        return

    is_seller = not user.is_bot

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

    # Reset inactivity timeout
    if chat_buffer.timeout_task and not chat_buffer.timeout_task.done():
        chat_buffer.timeout_task.cancel()
    chat_buffer.timeout_task = asyncio.create_task(
        _schedule_timeout(chat.id, user.id, context)
    )

    # Trigger immediately if message count threshold reached
    if buf.should_trigger_by_count(chat.id):
        if chat_buffer.timeout_task and not chat_buffer.timeout_task.done():
            chat_buffer.timeout_task.cancel()
        await _trigger_analysis(chat.id, context, seller_telegram_id=user.id)


async def cmd_analizar(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    if buf.message_count(chat_id) == 0:
        await update.message.reply_text("No hay mensajes acumulados para analizar.")
        return
    seller_id = update.effective_user.id if update.effective_user else None
    await _trigger_analysis(chat_id, context, seller_telegram_id=seller_id)


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    user = update.effective_user
    count = buf.message_count(chat_id)
    await update.message.reply_text(
        f"🤖 Bot activo\n📨 Mensajes en buffer: {count}\n⏱ Timeout: {BUFFER_TIMEOUT_SECONDS}s\n🪪 Tu Telegram ID: {user.id}"
    )


async def post_shutdown(app) -> None:
    """Cancel any pending timeout tasks on clean shutdown."""
    buf.cancel_all_timeouts()


def main() -> None:
    app = (
        ApplicationBuilder()
        .token(TELEGRAM_BOT_TOKEN)
        .post_shutdown(post_shutdown)
        .build()
    )

    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_message))
    app.add_handler(CommandHandler("analizar", cmd_analizar))
    app.add_handler(CommandHandler("status", cmd_status))

    logger.info("Bot iniciado. Esperando mensajes...")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
