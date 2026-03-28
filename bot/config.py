import os
from typing import Optional

from dotenv import load_dotenv


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if value is None or not value.strip():
        raise RuntimeError(
            f"Missing required environment variable: {name}. "
            "Add it to .env or export it before running the bot."
        )
    return value


load_dotenv()

TELEGRAM_BOT_TOKEN: str = _require_env("TELEGRAM_BOT_TOKEN")
OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
SUPABASE_URL: Optional[str] = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY: Optional[str] = os.getenv("SUPABASE_SERVICE_KEY")
DEFAULT_SELLER_COMPANY_ID: str = os.getenv(
    "DEFAULT_SELLER_COMPANY_ID",
    "11111111-1111-1111-1111-111111111111",
)
DEFAULT_SELLER_COMPANY_NAME: str = os.getenv(
    "DEFAULT_SELLER_COMPANY_NAME",
    "Demo Company",
)

# Buffer trigger thresholds
BUFFER_TIMEOUT_SECONDS: int = 30        # 30s inactivity → queue private review
BUFFER_MAX_MESSAGES: int = 20           # 20 messages → trigger analysis
