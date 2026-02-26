# backend/llm_client.py
import os
import json
import time
import requests
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

HF_TOKEN = os.getenv("HF_TOKEN")
LLM_DEBUG = os.getenv("LLM_DEBUG", "0") == "1"

# Keep your existing Router client (DO NOT remove)
client = OpenAI(
    base_url="https://router.huggingface.co/v1",
    api_key=HF_TOKEN,
)

HF_ENDPOINT_URL = (os.getenv("HF_ENDPOINT_URL") or "").strip()
HF_ENDPOINT_TOKEN = (os.getenv("HF_ENDPOINT_TOKEN") or HF_TOKEN or "").strip()


def _normalize_inner(inner: dict, latency_ms: int) -> dict:
    # Ensure required keys exist
    if not isinstance(inner.get("explanation_paragraph"), str):
        inner["explanation_paragraph"] = "No explanation provided."

    risk = str(inner.get("risk_level", "UNKNOWN")).upper().strip()
    if risk not in ("LOW", "MEDIUM", "HIGH"):
        risk = "UNKNOWN"
    inner["risk_level"] = risk

    inner["_latency_ms"] = latency_ms
    return inner


def call_finetuned_endpoint(event_data: dict, prediction: str, timeout: int = 120) -> dict:
    """
    Calls HF Inference Endpoint.
    Expected best-case response:
      {"raw": "{\"explanation_paragraph\":\"...\",\"risk_level\":\"LOW\"}"}

    But we also handle:
      {"explanation_paragraph":"...", "risk_level":"LOW"}
      [{"raw": "..."}] or [{"explanation_paragraph":...}]
    """

    if not HF_ENDPOINT_URL:
        raise RuntimeError("HF_ENDPOINT_URL missing in backend/.env")

    if not HF_ENDPOINT_TOKEN:
        raise RuntimeError("HF_ENDPOINT_TOKEN missing (or HF_TOKEN missing) in backend/.env")

    payload = {
        "inputs": {
            "event_data": event_data,
            "prediction": prediction
        }
    }

    headers = {
        "Authorization": f"Bearer {HF_ENDPOINT_TOKEN}",
        "Content-Type": "application/json",
    }

    t0 = time.time()
    resp = requests.post(HF_ENDPOINT_URL, headers=headers, json=payload, timeout=timeout)
    latency_ms = int((time.time() - t0) * 1000)

    if LLM_DEBUG:
        print("HF_ENDPOINT_URL:", HF_ENDPOINT_URL)
        print("STATUS:", resp.status_code)
        print("TEXT (first 500):", resp.text[:500])

    resp.raise_for_status()

    outer = resp.json()

    # Sometimes response can be a list
    if isinstance(outer, list) and len(outer) > 0:
        outer = outer[0]

    # Case A: {"raw": "<json-string>"}
    if isinstance(outer, dict) and "raw" in outer:
        raw_val = outer.get("raw")

        # raw could be a JSON string or already a dict
        if isinstance(raw_val, str):
            try:
                inner = json.loads(raw_val)
            except Exception:
                inner = {
                    "explanation_paragraph": "Invalid JSON returned from endpoint.",
                    "risk_level": "UNKNOWN",
                    "_raw": raw_val[:500],
                }
        elif isinstance(raw_val, dict):
            inner = raw_val
        else:
            inner = {
                "explanation_paragraph": "Unexpected endpoint response format (raw not str/dict).",
                "risk_level": "UNKNOWN",
            }

        return _normalize_inner(inner, latency_ms)

    # Case B: endpoint returns inner dict directly
    if isinstance(outer, dict) and ("explanation_paragraph" in outer or "risk_level" in outer):
        return _normalize_inner(outer, latency_ms)

    # Fallback
    return _normalize_inner(
        {
            "explanation_paragraph": "Unexpected endpoint response format.",
            "risk_level": "UNKNOWN",
            "_outer_preview": str(outer)[:500],
        },
        latency_ms
    )