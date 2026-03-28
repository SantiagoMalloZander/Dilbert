import os
import sys
import unittest
from pathlib import Path

os.environ.setdefault("TELEGRAM_BOT_TOKEN", "test-token")
BOT_DIR = Path(__file__).resolve().parents[1]
if str(BOT_DIR) not in sys.path:
    sys.path.insert(0, str(BOT_DIR))

from extractor import ExtractionResult
from validation import validate_extraction_result


class ValidationTests(unittest.TestCase):
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
            "raw": {},
        }
        payload.update(overrides)
        return ExtractionResult(**payload)

    def test_missing_client_name_and_currency_block_write(self) -> None:
        result = self.make_result(client_name=None, currency=None)

        validation = validate_extraction_result(result)

        self.assertFalse(validation.can_write)
        self.assertIn("nombre del cliente", validation.missing_fields)
        self.assertIn("moneda del monto detectado", validation.missing_fields)

    def test_invalid_contract_values_are_reported(self) -> None:
        result = self.make_result(currency="EUR", sentiment="mixed", suggested_status="follow_up")

        validation = validate_extraction_result(result)

        self.assertFalse(validation.can_write)
        self.assertEqual(3, len(validation.contract_errors))

    def test_multiple_matching_leads_require_clarification(self) -> None:
        result = self.make_result(client_company=None)

        validation = validate_extraction_result(result, lead_match_count=2)

        self.assertFalse(validation.can_write)
        self.assertTrue(any("varios leads" in message for message in validation.ambiguity_messages))


if __name__ == "__main__":
    unittest.main()
