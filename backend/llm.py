# backend/llm.py
import json
import re
from typing import Any, Dict, Tuple

from llm_client import client

PROMPT_VERSION = "v1.0-json-compact"

MODEL_NAME = "meta-llama/Llama-3.2-3B-Instruct"

#JSON_SCHEMA_HINT = """{"commuter_summary":"","operator_note":"","suggested_action":"","risk_level":"low|medium|high"}"""
JSON_SCHEMA_HINT = """{"explanation_paragraph":"","commuter_summary":"","operator_note":"","suggested_action":"","risk_level":"low|medium|high"}"""

def _extract_json_block(text: str) -> Tuple[bool, str]:
    """
    Extract the first {...} JSON-like block.
    Returns (found, json_text).
    """
    if not text:
        return False, ""
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return False, ""
    return True, match.group(0)


def generate_explanation(event_data: Dict[str, Any], prediction: str) -> Dict[str, Any]:
    """
    Calls LLM and returns a parsed JSON dict (best-effort).
    Never throws: always returns a dict containing either valid fields or an error.
    """
    try:
        prompt = f"""
You are an intelligent traffic assistant.

Return STRICT valid JSON only. No markdown. No backticks. No extra text.
You MUST output a complete JSON object and close it with a final }}.

Write explanation_paragraph as ONE paragraph in simple English, slightly detailed, friendly tone.
It should explain what the prediction means and what the user should do.

Event Data (JSON):
{json.dumps(event_data, ensure_ascii=False)}

Predicted lane_state:
{prediction}

Return JSON exactly in this format:
{JSON_SCHEMA_HINT}
""".strip()

        resp = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=250,
        )

        raw = (resp.choices[0].message.content or "").strip()

        # Attempt to fix incomplete JSON if it starts with { but doesn't end with }
        if raw.startswith("{") and not raw.endswith("}"):
            raw += "}"

        # First attempt: direct JSON parse
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass # Fall through to block extraction

        # Second attempt: extract {...} block and parse that
        found, block = _extract_json_block(raw)
        if found:
            try:
                return json.loads(block)
            except json.JSONDecodeError:
                return {
                    "error": "Invalid JSON format from LLM (after block extraction)",
                    "raw_output": raw,
                }

        # If neither direct parse nor block extraction worked
        return {
            "error": "No valid JSON found in LLM output",
            "raw_output": raw,
        }

    except Exception as e:
        return {
            "error": f"LLM generation or parsing failed: {str(e)}"
        }