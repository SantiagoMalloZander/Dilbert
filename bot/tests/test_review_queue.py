import os
import sys
import unittest
from pathlib import Path

os.environ.setdefault("TELEGRAM_BOT_TOKEN", "test-token")
BOT_DIR = Path(__file__).resolve().parents[1]
if str(BOT_DIR) not in sys.path:
    sys.path.insert(0, str(BOT_DIR))

import review_queue


class ReviewQueueTests(unittest.TestCase):
    def setUp(self) -> None:
        review_queue.clear_all()

    def tearDown(self) -> None:
        review_queue.clear_all()

    def test_enqueue_and_list_reviews_for_seller(self) -> None:
        review = review_queue.enqueue_review(
            allowed_seller_telegram_ids=[30, 40],
            source_chat_id=-1001,
            source_chat_title="Grupo Demo",
            transcript="[10:00] CLIENTE: hola",
            last_message_id=77,
            last_sender_id=88,
        )

        reviews = review_queue.list_reviews_for_seller(30)

        self.assertEqual(1, len(reviews))
        self.assertEqual(review.review_id, reviews[0].review_id)
        self.assertEqual("group-review:" + review.review_id, reviews[0].source_message_key)
        self.assertEqual(-1001, reviews[0].source_chat_id)
        self.assertEqual(77, reviews[0].last_message_id)
        self.assertEqual([30, 40], reviews[0].allowed_seller_telegram_ids)

    def test_pop_review_removes_it_from_seller_queue(self) -> None:
        first = review_queue.enqueue_review(
            allowed_seller_telegram_ids=[30, 40],
            source_chat_id=-1001,
            source_chat_title="Grupo Demo",
            transcript="uno",
        )
        second = review_queue.enqueue_review(
            allowed_seller_telegram_ids=[30],
            source_chat_id=-1002,
            source_chat_title="Grupo Dos",
            transcript="dos",
        )

        removed = review_queue.pop_review(first.review_id)
        remaining = review_queue.list_reviews_for_seller(30)
        remaining_for_second_seller = review_queue.list_reviews_for_seller(40)

        self.assertEqual(first.review_id, removed.review_id)
        self.assertEqual([second.review_id], [review.review_id for review in remaining])
        self.assertEqual([], remaining_for_second_seller)

    def test_peek_next_review_returns_oldest_pending_one(self) -> None:
        first = review_queue.enqueue_review(
            allowed_seller_telegram_ids=[30],
            source_chat_id=-1001,
            source_chat_title="Grupo Demo",
            transcript="uno",
        )
        review_queue.enqueue_review(
            allowed_seller_telegram_ids=[30],
            source_chat_id=-1002,
            source_chat_title="Grupo Dos",
            transcript="dos",
        )

        next_review = review_queue.peek_next_review(30)

        self.assertEqual(first.review_id, next_review.review_id)

    def test_seller_with_shared_review_can_see_it(self) -> None:
        review = review_queue.enqueue_review(
            allowed_seller_telegram_ids=[30, 40],
            source_chat_id=-1001,
            source_chat_title="Grupo Demo",
            transcript="uno",
        )

        reviews = review_queue.list_reviews_for_seller(40)

        self.assertEqual([review.review_id], [item.review_id for item in reviews])


if __name__ == "__main__":
    unittest.main()
