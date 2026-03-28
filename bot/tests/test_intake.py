import os
import sys
import unittest
from pathlib import Path
from types import ModuleType
from unittest.mock import AsyncMock, Mock, patch

os.environ.setdefault("TELEGRAM_BOT_TOKEN", "test-token")
BOT_DIR = Path(__file__).resolve().parents[1]
if str(BOT_DIR) not in sys.path:
    sys.path.insert(0, str(BOT_DIR))

supabase_stub = ModuleType("supabase")
supabase_stub.create_client = lambda *args, **kwargs: None
supabase_stub.Client = object
sys.modules.setdefault("supabase", supabase_stub)

import intake
from extractor import ExtractionResult


class IntakeTests(unittest.IsolatedAsyncioTestCase):
    def make_result(self, **overrides) -> ExtractionResult:
        payload = {
            "client_name": "Mariana",
            "client_company": "Acme",
            "product_interest": "Plan Enterprise",
            "estimated_amount": 5000.0,
            "currency": "USD",
            "sentiment": "positive",
            "next_steps": "Enviar propuesta",
            "suggested_status": "negotiating",
            "summary": "Lead caliente",
            "ambiguities": None,
            "is_returning_client": False,
            "raw": {"client_name": "Mariana"},
        }
        payload.update(overrides)
        return ExtractionResult(**payload)

    def make_context(self) -> intake.PrivateMessageContext:
        return intake.PrivateMessageContext(
            chat_id=10,
            message_id=20,
            user_id=30,
            sender_name="Demo Seller",
            seller_telegram_id=30,
            source_type="text",
            source_message_key="10:20",
        )

    def test_source_metadata_can_point_to_original_group_chat(self) -> None:
        context = intake.PrivateMessageContext(
            chat_id=900,
            message_id=901,
            user_id=30,
            sender_name="Demo Seller",
            seller_telegram_id=30,
            source_type="group_chat",
            source_message_key="group-review:R0001",
            source_chat_id=-123456,
            source_message_id=777,
            source_user_id=55,
        )

        metadata = context.as_source_metadata()

        self.assertEqual("group_chat", metadata.source_type)
        self.assertEqual(-123456, metadata.source_chat_id)
        self.assertEqual(777, metadata.source_message_id)
        self.assertEqual(55, metadata.source_user_id)
        self.assertEqual("group-review:R0001", metadata.source_message_key)

    async def test_group_review_clarification_keeps_original_source_metadata(self) -> None:
        result = self.make_result(client_name=None)
        context = intake.PrivateMessageContext(
            chat_id=900,
            message_id=901,
            user_id=30,
            sender_name="Demo Seller",
            seller_telegram_id=30,
            source_type="group_chat",
            source_message_key="group-review:R0001",
            source_chat_id=-123456,
            source_message_id=777,
            source_user_id=55,
        )

        with patch.object(intake.db, "get_interaction_by_source_message_key", return_value=None), patch.object(
            intake.extractor, "extract", AsyncMock(return_value=result)
        ), patch.object(
            intake.db, "get_seller_by_telegram_id", return_value={"id": "seller-db-id"}
        ), patch.object(
            intake.proactive, "set_pending", Mock()
        ) as set_pending_mock:
            outcome = await intake.process_private_transcript("texto normalizado", context)

        self.assertTrue(outcome.needs_clarification)
        _, kwargs = set_pending_mock.call_args
        self.assertEqual(900, kwargs["chat_id"])
        self.assertEqual(-123456, kwargs["source_chat_id"])
        self.assertEqual(777, kwargs["source_message_id"])
        self.assertEqual(55, kwargs["source_user_id"])

    async def test_successful_private_text_flow_reuses_crm_writer(self) -> None:
        result = self.make_result()
        with patch.object(intake.db, "get_interaction_by_source_message_key", return_value=None), patch.object(
            intake.extractor, "extract", AsyncMock(return_value=result)
        ), patch.object(
            intake.db, "get_seller_by_telegram_id", return_value={"id": "seller-db-id"}
        ), patch.object(
            intake.db, "find_lead_candidates", return_value=[]
        ), patch.object(
            intake.db, "upsert_lead_and_interaction", return_value={"id": "lead-1"}
        ) as upsert_mock, patch.object(
            intake.proactive, "clear_pending", Mock()
        ):
            outcome = await intake.process_private_transcript("texto normalizado", self.make_context())

        self.assertTrue(outcome.saved)
        self.assertFalse(outcome.needs_clarification)
        self.assertEqual(1, upsert_mock.call_count)
        args, kwargs = upsert_mock.call_args
        self.assertEqual(30, args[0])
        self.assertEqual("texto normalizado", args[1])
        self.assertEqual("10:20", kwargs["source_metadata"].source_message_key)

    async def test_duplicate_message_short_circuits_before_extraction(self) -> None:
        with patch.object(
            intake.db,
            "get_interaction_by_source_message_key",
            return_value={"id": "interaction-1"},
        ), patch.object(intake.extractor, "extract", AsyncMock()) as extract_mock:
            outcome = await intake.process_private_transcript("texto normalizado", self.make_context())

        self.assertTrue(outcome.duplicate)
        extract_mock.assert_not_awaited()

    async def test_missing_required_fields_creates_pending_clarification(self) -> None:
        result = self.make_result(client_name=None)
        with patch.object(intake.db, "get_interaction_by_source_message_key", return_value=None), patch.object(
            intake.extractor, "extract", AsyncMock(return_value=result)
        ), patch.object(
            intake.db, "get_seller_by_telegram_id", return_value={"id": "seller-db-id"}
        ), patch.object(
            intake.proactive, "set_pending", Mock()
        ) as set_pending_mock, patch.object(
            intake.db, "upsert_lead_and_interaction", Mock()
        ) as upsert_mock:
            outcome = await intake.process_private_transcript("texto normalizado", self.make_context())

        self.assertTrue(outcome.needs_clarification)
        self.assertFalse(outcome.saved)
        set_pending_mock.assert_called_once()
        upsert_mock.assert_not_called()
        self.assertTrue(any("nombre del cliente" in message for message in outcome.messages))

    async def test_ambiguous_existing_leads_block_write(self) -> None:
        result = self.make_result(client_company=None)
        with patch.object(intake.db, "get_interaction_by_source_message_key", return_value=None), patch.object(
            intake.extractor, "extract", AsyncMock(return_value=result)
        ), patch.object(
            intake.db, "get_seller_by_telegram_id", return_value={"id": "seller-db-id"}
        ), patch.object(
            intake.db, "find_lead_candidates", return_value=[{"id": "lead-1"}, {"id": "lead-2"}]
        ), patch.object(
            intake.proactive, "set_pending", Mock()
        ), patch.object(
            intake.db, "upsert_lead_and_interaction", Mock()
        ) as upsert_mock:
            outcome = await intake.process_private_transcript("texto normalizado", self.make_context())

        self.assertTrue(outcome.needs_clarification)
        upsert_mock.assert_not_called()

    async def test_crm_failure_is_reported_without_false_success(self) -> None:
        result = self.make_result()
        with patch.object(intake.db, "get_interaction_by_source_message_key", return_value=None), patch.object(
            intake.extractor, "extract", AsyncMock(return_value=result)
        ), patch.object(
            intake.db, "get_seller_by_telegram_id", return_value={"id": "seller-db-id"}
        ), patch.object(
            intake.db, "find_lead_candidates", return_value=[]
        ), patch.object(
            intake.db, "upsert_lead_and_interaction", side_effect=RuntimeError("supabase down")
        ), patch.object(
            intake.proactive, "clear_pending", Mock()
        ):
            outcome = await intake.process_private_transcript("texto normalizado", self.make_context())

        self.assertFalse(outcome.saved)
        self.assertTrue(any("No pude guardarlo en el CRM" in message for message in outcome.messages))


if __name__ == "__main__":
    unittest.main()
