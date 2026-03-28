import logging
from telegram import Update
from telegram.ext import ContextTypes
from extractor import extract_sales_data
from db import save_interaction

logger = logging.getLogger(__name__)

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    message = update.message
    if not message or not message.text:
        return

    chat_id = message.chat_id
    user = message.from_user
    text = message.text

    logger.info(f"Message from {user.username} in chat {chat_id}: {text[:50]}...")

    # Buffer messages per chat
    if "buffer" not in context.chat_data:
        context.chat_data["buffer"] = []

    context.chat_data["buffer"].append({
        "from": user.username or user.first_name,
        "text": text,
    })

    # Process every 5 messages or if message looks like a closing statement
    if len(context.chat_data["buffer"]) >= 5 or _is_closing(text):
        messages = context.chat_data["buffer"]
        context.chat_data["buffer"] = []

        extracted = await extract_sales_data(messages)
        if extracted:
            await save_interaction(
                chat_id=str(chat_id),
                seller_telegram_id=str(user.id),
                raw_messages=messages,
                extracted_data=extracted,
            )
            logger.info(f"Saved interaction for chat {chat_id}")

def _is_closing(text: str) -> bool:
    closing_keywords = ["gracias", "deal", "cerramos", "perfecto", "quedamos así"]
    return any(kw in text.lower() for kw in closing_keywords)
