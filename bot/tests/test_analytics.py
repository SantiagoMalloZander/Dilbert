from datetime import datetime, timezone
import unittest

from bot.analytics import CompanyContext, analyze_company_context


REFERENCE_NOW = datetime(2026, 3, 28, 12, 0, tzinfo=timezone.utc)


class AnalyticsTestCase(unittest.TestCase):
    def test_high_value_client_is_ranked_with_strong_prediction(self) -> None:
        context = CompanyContext(
            company={"id": "company-1", "name": "Dilbot SA"},
            sellers=[{"id": "seller-1", "company_id": "company-1", "name": "Ana"}],
            leads=[
                {
                    "id": "lead-1",
                    "company_id": "company-1",
                    "seller_id": "seller-1",
                    "client_name": "Acme",
                    "client_company": "Acme Corp",
                    "status": "negotiating",
                    "estimated_amount": 12000,
                    "currency": "USD",
                    "product_interest": "ERP",
                    "sentiment": "positive",
                    "last_interaction": "2026-03-26T12:00:00+00:00",
                    "created_at": "2026-03-01T12:00:00+00:00",
                },
                {
                    "id": "lead-2",
                    "company_id": "company-1",
                    "seller_id": "seller-1",
                    "client_name": "Acme",
                    "client_company": "Acme Corp",
                    "status": "closed_won",
                    "estimated_amount": 10000,
                    "currency": "USD",
                    "product_interest": "ERP",
                    "sentiment": "positive",
                    "last_interaction": "2026-02-20T12:00:00+00:00",
                    "created_at": "2026-02-01T12:00:00+00:00",
                },
            ],
            interactions=[
                {
                    "id": "int-1",
                    "lead_id": "lead-1",
                    "seller_id": "seller-1",
                    "raw_messages": "",
                    "extracted_data": {},
                    "summary": "Seguimiento semanal",
                    "created_at": "2026-03-10T12:00:00+00:00",
                },
                {
                    "id": "int-2",
                    "lead_id": "lead-1",
                    "seller_id": "seller-1",
                    "raw_messages": "",
                    "extracted_data": {},
                    "summary": "Piden propuesta",
                    "created_at": "2026-03-18T12:00:00+00:00",
                },
                {
                    "id": "int-3",
                    "lead_id": "lead-1",
                    "seller_id": "seller-1",
                    "raw_messages": "",
                    "extracted_data": {},
                    "summary": "Confirman presupuesto",
                    "created_at": "2026-03-25T12:00:00+00:00",
                },
            ],
        )

        report = analyze_company_context(context, now=REFERENCE_NOW)
        client = report["clients"][0]

        self.assertEqual(client["client_name"], "Acme")
        self.assertIn(client["segment"], {"alto_valor", "expansion"})
        self.assertGreater(client["purchase_probability_30d"], 0.6)
        self.assertGreater(client["predicted_30d_amount"], 7000)
        self.assertLessEqual(client["predicted_next_purchase_days"], 20)

    def test_stale_lost_client_is_marked_at_risk(self) -> None:
        context = CompanyContext(
            company={"id": "company-1", "name": "Dilbot SA"},
            sellers=[],
            leads=[
                {
                    "id": "lead-3",
                    "company_id": "company-1",
                    "seller_id": None,
                    "client_name": "Beta",
                    "client_company": "Beta SRL",
                    "status": "closed_lost",
                    "estimated_amount": 2500,
                    "currency": "ARS",
                    "product_interest": "POS",
                    "sentiment": "negative",
                    "last_interaction": "2025-12-15T12:00:00+00:00",
                    "created_at": "2025-11-20T12:00:00+00:00",
                }
            ],
            interactions=[],
        )

        report = analyze_company_context(context, now=REFERENCE_NOW)
        client = report["clients"][0]

        self.assertEqual(client["segment"], "en_riesgo")
        self.assertLess(client["purchase_probability_30d"], 0.25)
        self.assertGreater(client["recency_days"], 90)

    def test_summary_aggregates_client_predictions(self) -> None:
        context = CompanyContext(
            company={"id": "company-1", "name": "Dilbot SA"},
            sellers=[],
            leads=[
                {
                    "id": "lead-1",
                    "company_id": "company-1",
                    "seller_id": None,
                    "client_name": "Acme",
                    "client_company": "Acme Corp",
                    "status": "negotiating",
                    "estimated_amount": 8000,
                    "currency": "USD",
                    "product_interest": "ERP",
                    "sentiment": "positive",
                    "last_interaction": "2026-03-26T12:00:00+00:00",
                    "created_at": "2026-03-01T12:00:00+00:00",
                },
                {
                    "id": "lead-2",
                    "company_id": "company-1",
                    "seller_id": None,
                    "client_name": "Gamma",
                    "client_company": "Gamma SA",
                    "status": "contacted",
                    "estimated_amount": 3000,
                    "currency": "ARS",
                    "product_interest": "POS",
                    "sentiment": "neutral",
                    "last_interaction": "2026-03-20T12:00:00+00:00",
                    "created_at": "2026-03-10T12:00:00+00:00",
                },
            ],
            interactions=[],
        )

        report = analyze_company_context(context, now=REFERENCE_NOW)
        summary = report["summary"]

        self.assertEqual(summary["company_name"], "Dilbot SA")
        self.assertEqual(summary["total_clients"], 2)
        self.assertGreater(summary["predicted_30d_revenue"], 0)
        self.assertGreater(summary["predicted_90d_revenue"], summary["predicted_30d_revenue"])
        self.assertIn("ERP", [item["product"] for item in summary["top_products"]])


if __name__ == "__main__":
    unittest.main()
