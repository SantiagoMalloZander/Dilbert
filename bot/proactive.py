"""
Proactive context tracking.

When the bot asks a clarification question, we store the previous transcript
so that the seller's answer can be merged with it before re-analysis.
"""
import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class PendingClarification:
    previous_transcript: str
    seller_telegram_id: int
    questions: list[str]


# chat_id → pending clarification
_pending: dict[int, PendingClarification] = {}


def set_pending(
    chat_id: int,
    previous_transcript: str,
    seller_telegram_id: int,
    questions: list[str],
) -> None:
    _pending[chat_id] = PendingClarification(
        previous_transcript=previous_transcript,
        seller_telegram_id=seller_telegram_id,
        questions=questions,
    )
    logger.info("pending clarification set chat=%s | %d questions", chat_id, len(questions))


def get_pending(chat_id: int) -> Optional[PendingClarification]:
    return _pending.get(chat_id)


def clear_pending(chat_id: int) -> None:
    _pending.pop(chat_id, None)
    logger.info("pending clarification cleared chat=%s", chat_id)


def has_pending(chat_id: int) -> bool:
    return chat_id in _pending


def build_enriched_transcript(chat_id: int, clarification_text: str) -> str:
    """Merge previous transcript with the seller's clarification answer."""
    pending = _pending[chat_id]
    return (
        pending.previous_transcript
        + f"\n[ACLARACIÓN DEL VENDEDOR]: {clarification_text}"
    )
