import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from types import ModuleType
from unittest.mock import patch

os.environ.setdefault("TELEGRAM_BOT_TOKEN", "test-token")
BOT_DIR = Path(__file__).resolve().parents[1]
if str(BOT_DIR) not in sys.path:
    sys.path.insert(0, str(BOT_DIR))

supabase_stub = ModuleType("supabase")
supabase_stub.create_client = lambda *args, **kwargs: None
supabase_stub.Client = object
sys.modules.setdefault("supabase", supabase_stub)

import db
from extractor import ExtractionResult


class DBContractTests(unittest.TestCase):
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

    def test_create_lead_keeps_existing_crm_payload_shape(self) -> None:
        captured = {}

        class TableMock:
            def insert(self, row):
                captured["row"] = row
                return self

            def execute(self):
                return SimpleNamespace(data=[{"id": "lead-1", "client_name": "Mariana"}])

        class ClientMock:
            def table(self, name):
                self.name = name
                return TableMock()

        with patch.object(db, "_get_client", return_value=ClientMock()):
            db.create_lead("seller-1", "company-1", self.make_result())

        self.assertEqual(
            {
                "seller_id",
                "company_id",
                "client_name",
                "client_company",
                "status",
                "estimated_amount",
                "currency",
                "product_interest",
                "sentiment",
                "next_steps",
                "last_interaction",
            },
            set(captured["row"].keys()),
        )
        self.assertEqual("seller-1", captured["row"]["seller_id"])
        self.assertEqual("company-1", captured["row"]["company_id"])
        self.assertEqual("Mariana", captured["row"]["client_name"])
        self.assertEqual("Acme", captured["row"]["client_company"])

    def test_update_lead_only_updates_supported_non_null_fields(self) -> None:
        captured = {}

        class TableMock:
            def update(self, row):
                captured["row"] = row
                return self

            def eq(self, column, value):
                captured["eq"] = (column, value)
                return self

            def execute(self):
                return SimpleNamespace(data=[{"id": "lead-1"}])

        class ClientMock:
            def table(self, name):
                self.name = name
                return TableMock()

        result = self.make_result(product_interest=None, next_steps=None)
        with patch.object(db, "_get_client", return_value=ClientMock()):
            db.update_lead("lead-1", result)

        self.assertEqual(("id", "lead-1"), captured["eq"])
        self.assertNotIn("product_interest", captured["row"])
        self.assertNotIn("next_steps", captured["row"])
        self.assertEqual("negotiating", captured["row"]["status"])

    def test_create_interaction_adds_source_metadata_without_losing_existing_fields(self) -> None:
        captured = {}

        class TableMock:
            def insert(self, row):
                captured["row"] = row
                return self

            def execute(self):
                return SimpleNamespace(data=[{"id": "interaction-1"}])

        class ClientMock:
            def table(self, name):
                self.name = name
                return TableMock()

        metadata = db.InteractionSourceMetadata(
            source_type="voice",
            source_chat_id=123,
            source_message_id=456,
            source_user_id=789,
            source_message_key="123:456",
        )

        with patch.object(db, "_get_client", return_value=ClientMock()):
            db.create_interaction(
                "lead-1",
                "seller-1",
                "raw transcript",
                self.make_result(),
                source_metadata=metadata,
            )

        self.assertEqual("lead-1", captured["row"]["lead_id"])
        self.assertEqual("seller-1", captured["row"]["seller_id"])
        self.assertEqual("raw transcript", captured["row"]["raw_messages"])
        self.assertEqual({"client_name": "Mariana"}, captured["row"]["extracted_data"])
        self.assertEqual("Lead caliente", captured["row"]["summary"])
        self.assertEqual("voice", captured["row"]["source_type"])
        self.assertEqual("123:456", captured["row"]["source_message_key"])

    def test_create_seller_uses_default_contract_and_stringifies_telegram_id(self) -> None:
        captured = {}

        class TableMock:
            def insert(self, row):
                captured["row"] = row
                return self

            def execute(self):
                return SimpleNamespace(data=[{"id": "seller-1", "telegram_user_id": "12345"}])

        class ClientMock:
            def table(self, name):
                self.name = name
                return TableMock()

        with patch.object(db, "_get_client", return_value=ClientMock()):
            db.create_seller(12345, "Judge One", company_id="company-1")

        self.assertEqual("company-1", captured["row"]["company_id"])
        self.assertEqual("Judge One", captured["row"]["name"])
        self.assertEqual("12345", captured["row"]["telegram_user_id"])

    def test_ensure_seller_returns_existing_row_without_creating(self) -> None:
        existing = {"id": "seller-1", "telegram_user_id": "12345"}
        with patch.object(db, "get_seller_by_telegram_id", return_value=existing), patch.object(
            db, "ensure_default_company"
        ) as ensure_company_mock, patch.object(db, "create_seller") as create_seller_mock:
            seller, created = db.ensure_seller_for_telegram_user(12345, "Judge One")

        self.assertFalse(created)
        self.assertEqual(existing, seller)
        ensure_company_mock.assert_not_called()
        create_seller_mock.assert_not_called()

    def test_ensure_seller_creates_company_and_seller_when_missing(self) -> None:
        created_seller = {"id": "seller-1", "telegram_user_id": "12345"}
        with patch.object(db, "get_seller_by_telegram_id", return_value=None), patch.object(
            db, "ensure_default_company", return_value={"id": "company-1"}
        ) as ensure_company_mock, patch.object(
            db, "create_seller", return_value=created_seller
        ) as create_seller_mock:
            seller, created = db.ensure_seller_for_telegram_user(12345, "Judge One")

        self.assertTrue(created)
        self.assertEqual(created_seller, seller)
        ensure_company_mock.assert_called_once()
        create_seller_mock.assert_called_once_with(12345, "Judge One")


if __name__ == "__main__":
    unittest.main()
