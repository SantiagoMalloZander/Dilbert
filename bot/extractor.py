import json
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from openai import AsyncOpenAI

from config import OPENAI_API_KEY
from prompts import EXTRACTION_SYSTEM, EXTRACTION_USER

logger = logging.getLogger(__name__)

_client: Optional[AsyncOpenAI] = None


def get_openai_client() -> AsyncOpenAI:
    global _client

    if _client is None:
        if not OPENAI_API_KEY:
            raise RuntimeError(
                "Missing required environment variable: OPENAI_API_KEY. "
                "Set it in .env before running the extractor."
            )
        _client = AsyncOpenAI(api_key=OPENAI_API_KEY)

    return _client


def _get_client() -> AsyncOpenAI:
    return get_openai_client()


@dataclass
class ExtractionResult:
    client_name: Optional[str]
    client_company: Optional[str]
    product_interest: Optional[str]
    estimated_amount: Optional[float]
    currency: Optional[str]
    sentiment: str
    next_steps: Optional[str]
    suggested_status: str
    summary: str
    ambiguities: Optional[List[str]]
    is_returning_client: bool
    raw: Dict[str, Any]  # full LLM response for debugging


async def extract(transcript: str) -> ExtractionResult:
    logger.info("calling LLM | transcript length=%d chars", len(transcript))

    client = _get_client()

    response = await client.chat.completions.create(
        model="gpt-4o",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": EXTRACTION_SYSTEM},
            {"role": "user", "content": EXTRACTION_USER.format(transcript=transcript)},
        ],
        temperature=0,
    )

    raw = json.loads(response.choices[0].message.content)
    logger.info("LLM response: %s", json.dumps(raw, ensure_ascii=False))

    return ExtractionResult(
        client_name=raw.get("client_name"),
        client_company=raw.get("client_company"),
        product_interest=raw.get("product_interest"),
        estimated_amount=raw.get("estimated_amount"),
        currency=raw.get("currency"),
        sentiment=raw.get("sentiment", "neutral"),
        next_steps=raw.get("next_steps"),
        suggested_status=raw.get("suggested_status", "new"),
        summary=raw.get("summary", ""),
        ambiguities=raw.get("ambiguities") or None,
        is_returning_client=bool(raw.get("is_returning_client", False)),
        raw=raw,
    )
