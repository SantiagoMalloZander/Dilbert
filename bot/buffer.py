import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from config import BUFFER_MAX_MESSAGES, BUFFER_TIMEOUT_SECONDS  # noqa: F401 (re-exported)

logger = logging.getLogger(__name__)


@dataclass
class BufferedMessage:
    text: str
    sender_name: str
    sender_id: int
    message_id: int
    is_seller: bool
    timestamp: datetime


_FAREWELL_PHRASES = [
    "hasta luego", "hasta mañana", "hasta pronto", "nos hablamos",
    "nos vemos", "chau", "bye", "quedamos así", "bueno quedamos",
    "gracias por tu tiempo", "te mando la propuesta", "te escribo",
    "hablamos pronto", "un abrazo", "saludos", "te llamo",
    "perfecto nos hablamos", "dale quedamos", "dale gracias",
]


def detect_farewell(text: str) -> bool:
    """True si el texto contiene una frase típica de cierre de conversación."""
    lower = text.lower()
    return any(phrase in lower for phrase in _FAREWELL_PHRASES)


@dataclass
class ChatBuffer:
    chat_id: int
    chat_title: Optional[str] = None
    messages: list[BufferedMessage] = field(default_factory=list)
    timeout_task: Optional[asyncio.Task] = field(default=None, repr=False)
    seller_telegram_id: Optional[int] = field(default=None)
    use_short_timeout: bool = field(default=False)


# Global buffer: chat_id → ChatBuffer
_buffers: dict[int, ChatBuffer] = {}


def get_or_create(chat_id: int) -> ChatBuffer:
    if chat_id not in _buffers:
        _buffers[chat_id] = ChatBuffer(chat_id=chat_id)
    return _buffers[chat_id]


def add_message(
    chat_id: int,
    chat_title: Optional[str],
    text: str,
    sender_name: str,
    sender_id: int,
    message_id: int,
    is_seller: bool,
) -> ChatBuffer:
    buf = get_or_create(chat_id)
    buf.chat_title = chat_title or buf.chat_title
    buf.messages.append(
        BufferedMessage(
            text=text,
            sender_name=sender_name,
            sender_id=sender_id,
            message_id=message_id,
            is_seller=is_seller,
            timestamp=datetime.now(timezone.utc),
        )
    )
    logger.info(
        "buffer chat=%s | %d msgs | sender=%s (seller=%s) | %r",
        chat_id,
        len(buf.messages),
        sender_name,
        is_seller,
        text[:60],
    )
    return buf


def flush(chat_id: int) -> list[BufferedMessage]:
    """Return accumulated messages and clear the buffer."""
    buf = _buffers.get(chat_id)
    if not buf:
        return []
    messages = buf.messages.copy()
    buf.messages.clear()
    if buf.timeout_task and not buf.timeout_task.done():
        buf.timeout_task.cancel()
        buf.timeout_task = None
    logger.info("buffer flushed chat=%s | %d msgs returned", chat_id, len(messages))
    return messages


def should_trigger_by_count(chat_id: int) -> bool:
    buf = _buffers.get(chat_id)
    return bool(buf and len(buf.messages) >= BUFFER_MAX_MESSAGES)


def message_count(chat_id: int) -> int:
    buf = _buffers.get(chat_id)
    return len(buf.messages) if buf else 0


def format_for_llm(messages: list[BufferedMessage]) -> str:
    """Format buffered messages as a readable chat transcript."""
    lines = []
    for m in messages:
        role = "VENDEDOR" if m.is_seller else "CLIENTE"
        ts = m.timestamp.strftime("%H:%M")
        lines.append(f"[{ts}] {role} ({m.sender_name}): {m.text}")
    return "\n".join(lines)


def cancel_all_timeouts() -> None:
    """Cancel pending timeout tasks during shutdown."""
    for chat_buffer in _buffers.values():
        if chat_buffer.timeout_task and not chat_buffer.timeout_task.done():
            chat_buffer.timeout_task.cancel()
            chat_buffer.timeout_task = None
    logger.info("all timeout tasks cancelled")
