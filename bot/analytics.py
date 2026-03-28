import argparse
import json
import math
import os
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from statistics import median
from typing import TYPE_CHECKING, Any, Iterable, Optional

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv() -> None:
        return None

if TYPE_CHECKING:
    from supabase import Client
else:
    Client = Any


load_dotenv()


STATUS_WEIGHTS = {
    "new": 0.2,
    "contacted": 0.4,
    "negotiating": 0.7,
    "closed_won": 1.0,
    "closed_lost": 0.05,
}

SENTIMENT_WEIGHTS = {
    "negative": 0.1,
    "neutral": 0.5,
    "positive": 0.85,
}

DEFAULT_COMPANY_ID = os.getenv("ANALYTICS_COMPANY_ID", "11111111-1111-1111-1111-111111111111")


@dataclass
class CompanyContext:
    company: dict[str, Any]
    sellers: list[dict[str, Any]]
    leads: list[dict[str, Any]]
    interactions: list[dict[str, Any]]


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if value is None or not value.strip():
        raise RuntimeError(
            f"Missing required environment variable: {name}. "
            "Configure it before running the analytics bot."
        )
    return value


def get_analytics_client() -> Client:
    try:
        from supabase import create_client
    except ImportError as exc:
        raise RuntimeError(
            "Supabase client library is not installed. Run `pip install -r bot/requirements.txt`."
        ) from exc

    url = _require_env("SUPABASE_URL")
    key = (
        os.getenv("SUPABASE_ANALYTICS_KEY")
        or os.getenv("SUPABASE_SERVICE_KEY")
        or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    )
    if not key or not key.strip():
        raise RuntimeError(
            "Missing Supabase read credential. Set SUPABASE_ANALYTICS_KEY, "
            "SUPABASE_SERVICE_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY."
        )
    return create_client(url, key)


def _parse_datetime(value: Optional[str], fallback: Optional[datetime] = None) -> datetime:
    if not value:
        if fallback is not None:
            return fallback
        return datetime.now(timezone.utc)

    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _safe_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _average(values: Iterable[float], default: float = 0.0) -> float:
    collected = list(values)
    if not collected:
        return default
    return sum(collected) / len(collected)


def _days_between(first: datetime, second: datetime) -> float:
    return max((second - first).total_seconds() / 86400, 0.0)


def _normalize_client_key(lead: dict[str, Any]) -> str:
    client_name = (lead.get("client_name") or "").strip().lower()
    client_company = (lead.get("client_company") or "").strip().lower()
    if client_name or client_company:
        return f"{client_name}::{client_company}"
    return f"lead::{lead['id']}"


def _batched(items: list[str], size: int) -> Iterable[list[str]]:
    for start in range(0, len(items), size):
        yield items[start : start + size]


def fetch_company_context(company_id: str, client: Optional[Client] = None) -> CompanyContext:
    db = client or get_analytics_client()

    company_response = (
        db.table("companies")
        .select("*")
        .eq("id", company_id)
        .single()
        .execute()
    )
    company = company_response.data

    sellers_response = (
        db.table("sellers")
        .select("*")
        .eq("company_id", company_id)
        .execute()
    )
    sellers = sellers_response.data or []

    leads_response = (
        db.table("leads")
        .select("*")
        .eq("company_id", company_id)
        .order("last_interaction", desc=True)
        .execute()
    )
    leads = leads_response.data or []

    lead_ids = [lead["id"] for lead in leads]
    interactions: list[dict[str, Any]] = []
    for batch in _batched(lead_ids, 100):
        response = (
            db.table("interactions")
            .select("*")
            .in_("lead_id", batch)
            .order("created_at", desc=False)
            .execute()
        )
        interactions.extend(response.data or [])

    return CompanyContext(
        company=company,
        sellers=sellers,
        leads=leads,
        interactions=interactions,
    )


def _portfolio_baseline(leads: list[dict[str, Any]]) -> float:
    amounts = [
        amount
        for amount in (_safe_float(lead.get("estimated_amount")) for lead in leads)
        if amount is not None and amount > 0
    ]
    if not amounts:
        return 1.0
    return max(median(amounts), 1.0)


def _build_client_groups(
    leads: list[dict[str, Any]],
    interactions: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    grouped_leads: dict[str, list[dict[str, Any]]] = defaultdict(list)
    grouped_interactions: dict[str, list[dict[str, Any]]] = defaultdict(list)
    lead_to_client_key: dict[str, str] = {}

    for lead in leads:
        client_key = _normalize_client_key(lead)
        grouped_leads[client_key].append(lead)
        lead_to_client_key[lead["id"]] = client_key

    for interaction in interactions:
        client_key = lead_to_client_key.get(interaction["lead_id"])
        if client_key:
            grouped_interactions[client_key].append(interaction)

    groups: list[dict[str, Any]] = []
    for client_key, client_leads in grouped_leads.items():
        sorted_leads = sorted(
            client_leads,
            key=lambda lead: _parse_datetime(
                lead.get("last_interaction") or lead.get("created_at")
            ),
            reverse=True,
        )
        groups.append(
            {
                "client_key": client_key,
                "client_name": sorted_leads[0].get("client_name") or "Sin nombre",
                "client_company": sorted_leads[0].get("client_company") or "-",
                "leads": sorted_leads,
                "interactions": sorted(
                    grouped_interactions.get(client_key, []),
                    key=lambda interaction: _parse_datetime(interaction.get("created_at")),
                ),
            }
        )

    return groups


def _resolve_segment(probability: float, recency_days: float, interaction_count: int, won_count: int, lost_count: int) -> str:
    if lost_count > won_count and recency_days > 45:
        return "en_riesgo"
    if probability >= 0.75 and interaction_count >= 4:
        return "alto_valor"
    if probability >= 0.55 and interaction_count >= 2:
        return "expansion"
    if interaction_count <= 1:
        return "exploratorio"
    return "ocasional"


def _segment_label(segment: str) -> str:
    labels = {
        "alto_valor": "Alto valor",
        "expansion": "En expansion",
        "exploratorio": "Exploratorio",
        "ocasional": "Ocasional",
        "en_riesgo": "En riesgo",
    }
    return labels.get(segment, segment)


def _build_key_drivers(
    most_recent_status: str,
    recency_days: float,
    interaction_count: int,
    top_product: str,
    sentiment_score: float,
) -> list[str]:
    drivers = [f"Estado actual: {most_recent_status}"]
    if recency_days <= 14:
        drivers.append("Interaccion reciente en los ultimos 14 dias")
    elif recency_days >= 45:
        drivers.append("Baja actividad reciente")

    if interaction_count >= 4:
        drivers.append("Frecuencia de contacto superior al promedio")
    elif interaction_count <= 1:
        drivers.append("Pocas interacciones registradas")

    if top_product != "-":
        drivers.append(f"Producto dominante: {top_product}")

    if sentiment_score >= 0.7:
        drivers.append("Señales conversacionales favorables")
    elif sentiment_score <= 0.3:
        drivers.append("Señales conversacionales adversas")

    return drivers


def analyze_client_group(
    group: dict[str, Any],
    monetary_baseline: float,
    now: Optional[datetime] = None,
) -> dict[str, Any]:
    reference_time = now or datetime.now(timezone.utc)
    leads = group["leads"]
    interactions = group["interactions"]
    recent_lead = leads[0]

    statuses = [lead.get("status") or "new" for lead in leads]
    sentiments = [lead.get("sentiment") for lead in leads if lead.get("sentiment")]
    products = [lead.get("product_interest") for lead in leads if lead.get("product_interest")]
    amounts = [_safe_float(lead.get("estimated_amount")) for lead in leads]
    clean_amounts = [amount for amount in amounts if amount is not None and amount > 0]

    lead_dates = [
        _parse_datetime(lead.get("last_interaction") or lead.get("created_at"), reference_time)
        for lead in leads
    ]
    interaction_dates = [
        _parse_datetime(interaction.get("created_at"), reference_time)
        for interaction in interactions
    ]

    all_touchpoints = sorted(lead_dates + interaction_dates)
    last_touchpoint = all_touchpoints[-1] if all_touchpoints else reference_time
    recency_days = _days_between(last_touchpoint, reference_time)

    cadence_days = 30.0
    if len(all_touchpoints) >= 2:
        gaps = [
            _days_between(previous, current)
            for previous, current in zip(all_touchpoints, all_touchpoints[1:])
            if _days_between(previous, current) > 0
        ]
        if gaps:
            cadence_days = _average(gaps, default=30.0)

    interaction_count = max(len(interactions), len(leads))
    status_score = _average(
        [STATUS_WEIGHTS.get(status, STATUS_WEIGHTS["new"]) for status in statuses],
        default=STATUS_WEIGHTS["new"],
    )
    sentiment_score = _average(
        [SENTIMENT_WEIGHTS.get(sentiment, 0.5) for sentiment in sentiments],
        default=0.5,
    )
    recency_score = math.exp(-recency_days / 45.0)
    frequency_score = _clamp(interaction_count / 6.0, 0.1, 1.0)
    won_count = sum(1 for status in statuses if status == "closed_won")
    lost_count = sum(1 for status in statuses if status == "closed_lost")
    history_score = won_count / max(len(leads), 1)
    loss_penalty = lost_count / max(len(leads), 1)

    average_amount = _average(clean_amounts, default=0.0)
    monetary_score = _clamp(average_amount / monetary_baseline, 0.0, 2.0) / 2.0

    purchase_probability = _clamp(
        0.30 * status_score
        + 0.20 * sentiment_score
        + 0.20 * recency_score
        + 0.15 * frequency_score
        + 0.15 * history_score
        - 0.15 * loss_penalty,
        0.05,
        0.98,
    )

    projected_30d_amount = round(
        average_amount
        * purchase_probability
        * (0.85 + frequency_score * 0.35 + monetary_score * 0.20),
        2,
    )
    projected_90d_amount = round(
        projected_30d_amount * (1.9 + history_score * 0.4 + frequency_score * 0.2),
        2,
    )

    urgency_factor = _clamp(1.85 - status_score - sentiment_score / 2.0, 0.55, 1.6)
    predicted_next_purchase_days = max(7, round(cadence_days * urgency_factor))

    top_product = Counter(products).most_common(1)[0][0] if products else "-"
    segment = _resolve_segment(
        probability=purchase_probability,
        recency_days=recency_days,
        interaction_count=interaction_count,
        won_count=won_count,
        lost_count=lost_count,
    )

    confidence_score = _clamp(
        0.35 + min(len(leads), 4) * 0.1 + min(len(interactions), 6) * 0.05,
        0.35,
        0.95,
    )

    return {
        "client_key": group["client_key"],
        "client_name": group["client_name"],
        "client_company": group["client_company"],
        "lead_count": len(leads),
        "interaction_count": len(interactions),
        "current_status": recent_lead.get("status") or "new",
        "dominant_product": top_product,
        "dominant_currency": recent_lead.get("currency") or "ARS",
        "average_estimated_amount": round(average_amount, 2),
        "predicted_30d_amount": projected_30d_amount,
        "predicted_90d_amount": projected_90d_amount,
        "purchase_probability_30d": round(purchase_probability, 4),
        "predicted_next_purchase_days": predicted_next_purchase_days,
        "recency_days": round(recency_days, 1),
        "average_cadence_days": round(cadence_days, 1),
        "sentiment_score": round(sentiment_score, 4),
        "confidence_score": round(confidence_score, 4),
        "segment": segment,
        "segment_label": _segment_label(segment),
        "top_drivers": _build_key_drivers(
            most_recent_status=recent_lead.get("status") or "new",
            recency_days=recency_days,
            interaction_count=len(interactions),
            top_product=top_product,
            sentiment_score=sentiment_score,
        ),
    }


def analyze_company_context(context: CompanyContext, now: Optional[datetime] = None) -> dict[str, Any]:
    groups = _build_client_groups(context.leads, context.interactions)
    baseline = _portfolio_baseline(context.leads)

    clients = [
        analyze_client_group(group, monetary_baseline=baseline, now=now)
        for group in groups
    ]
    ranked_clients = sorted(
        clients,
        key=lambda client: (
            client["predicted_30d_amount"],
            client["purchase_probability_30d"],
            -client["recency_days"],
        ),
        reverse=True,
    )

    product_counter = Counter(
        client["dominant_product"]
        for client in ranked_clients
        if client["dominant_product"] != "-"
    )
    segment_counter = Counter(client["segment_label"] for client in ranked_clients)

    summary = {
        "company_id": context.company["id"],
        "company_name": context.company["name"],
        "generated_at": (now or datetime.now(timezone.utc)).isoformat(),
        "total_clients": len(ranked_clients),
        "total_leads": len(context.leads),
        "total_interactions": len(context.interactions),
        "predicted_30d_revenue": round(
            sum(client["predicted_30d_amount"] for client in ranked_clients), 2
        ),
        "predicted_90d_revenue": round(
            sum(client["predicted_90d_amount"] for client in ranked_clients), 2
        ),
        "average_purchase_probability_30d": round(
            _average(
                [client["purchase_probability_30d"] for client in ranked_clients],
                default=0.0,
            ),
            4,
        ),
        "top_products": [
            {"product": product, "clients": count}
            for product, count in product_counter.most_common(5)
        ],
        "segment_breakdown": dict(segment_counter),
    }

    return {
        "summary": summary,
        "clients": ranked_clients,
    }


def build_company_report(company_id: str, client: Optional[Client] = None) -> dict[str, Any]:
    context = fetch_company_context(company_id=company_id, client=client)
    return analyze_company_context(context)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Read-only client consumption analysis using the CRM data in Supabase."
    )
    parser.add_argument(
        "--company-id",
        default=DEFAULT_COMPANY_ID,
        help="Company UUID to analyze. Defaults to ANALYTICS_COMPANY_ID or the demo company.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print the full report as JSON.",
    )
    parser.add_argument(
        "--top",
        type=int,
        default=5,
        help="How many clients to display in text mode.",
    )
    args = parser.parse_args()

    report = build_company_report(args.company_id)

    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=True))
        return

    summary = report["summary"]
    print(f"Company: {summary['company_name']} ({summary['company_id']})")
    print(f"Projected 30d revenue: {summary['predicted_30d_revenue']}")
    print(f"Projected 90d revenue: {summary['predicted_90d_revenue']}")
    print(f"Average 30d purchase probability: {summary['average_purchase_probability_30d']}")
    print("")
    print("Top clients:")
    for client in report["clients"][: args.top]:
        print(
            "- "
            f"{client['client_name']} | {client['segment_label']} | "
            f"prob={client['purchase_probability_30d']} | "
            f"30d={client['predicted_30d_amount']} {client['dominant_currency']} | "
            f"next={client['predicted_next_purchase_days']}d"
        )


if __name__ == "__main__":
    main()
