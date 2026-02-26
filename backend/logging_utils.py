# backend/logging_utils.py
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

LOG_DIR = Path(__file__).resolve().parents[1] / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

LLM_LOG_PATH = LOG_DIR / "llm_calls.jsonl"


def log_llm_call(payload: Dict[str, Any]) -> None:
    """
    Append a single line JSON entry to logs/llm_calls.jsonl
    """
    entry = {
        "ts_utc": datetime.utcnow().isoformat() + "Z",
        **payload,
    }
    with LLM_LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")