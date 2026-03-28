import json
import logging
from datetime import datetime
from typing import Any


def _default(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def log_stage(
    logger: logging.Logger,
    stage: str,
    *,
    level: str = "info",
    **fields: Any,
) -> None:
    payload = {"stage": stage, **fields}
    message = json.dumps(payload, ensure_ascii=False, default=_default)
    log_method = getattr(logger, level, logger.info)
    log_method(message)
