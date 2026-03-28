import itertools
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional


@dataclass
class PendingGroupReview:
    review_id: str
    allowed_seller_telegram_ids: list[int]
    source_chat_id: int
    source_chat_title: str
    transcript: str
    source_message_key: str
    last_message_id: Optional[int] = None
    last_sender_id: Optional[int] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


_review_counter = itertools.count(1)
_reviews_by_id: dict[str, PendingGroupReview] = {}
_seller_review_ids: dict[int, list[str]] = {}


def enqueue_review(
    *,
    allowed_seller_telegram_ids: list[int],
    source_chat_id: int,
    source_chat_title: Optional[str],
    transcript: str,
    last_message_id: Optional[int] = None,
    last_sender_id: Optional[int] = None,
) -> PendingGroupReview:
    normalized_seller_ids = list(dict.fromkeys(allowed_seller_telegram_ids))
    if not normalized_seller_ids:
        raise ValueError("allowed_seller_telegram_ids must not be empty")

    review_id = f"R{next(_review_counter):04d}"
    review = PendingGroupReview(
        review_id=review_id,
        allowed_seller_telegram_ids=normalized_seller_ids,
        source_chat_id=source_chat_id,
        source_chat_title=source_chat_title or f"chat {source_chat_id}",
        transcript=transcript,
        source_message_key=f"group-review:{review_id}",
        last_message_id=last_message_id,
        last_sender_id=last_sender_id,
    )
    _reviews_by_id[review_id] = review
    for seller_telegram_id in normalized_seller_ids:
        _seller_review_ids.setdefault(seller_telegram_id, []).append(review_id)
    return review


def get_review(review_id: str) -> Optional[PendingGroupReview]:
    return _reviews_by_id.get(review_id)


def list_reviews_for_seller(seller_telegram_id: int) -> list[PendingGroupReview]:
    review_ids = _seller_review_ids.get(seller_telegram_id, [])
    return [review for review_id in review_ids if (review := _reviews_by_id.get(review_id))]


def pop_review(review_id: str) -> Optional[PendingGroupReview]:
    review = _reviews_by_id.pop(review_id, None)
    if not review:
        return None

    for seller_telegram_id in review.allowed_seller_telegram_ids:
        seller_reviews = _seller_review_ids.get(seller_telegram_id, [])
        _seller_review_ids[seller_telegram_id] = [
            existing_review_id for existing_review_id in seller_reviews if existing_review_id != review_id
        ]
        if not _seller_review_ids[seller_telegram_id]:
            _seller_review_ids.pop(seller_telegram_id, None)
    return review


def peek_next_review(seller_telegram_id: int) -> Optional[PendingGroupReview]:
    reviews = list_reviews_for_seller(seller_telegram_id)
    return reviews[0] if reviews else None


def clear_all() -> None:
    _reviews_by_id.clear()
    _seller_review_ids.clear()
