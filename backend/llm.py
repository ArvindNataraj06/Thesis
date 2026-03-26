# backend/llm.py
from typing import Any, Dict
from llm_client import call_finetuned_endpoint

PROMPT_VERSION = "v1.0-json-compact"
MODEL_NAME = "meta-llama/Llama-3.2-3B-Instruct"

def generate_explanation(event_data: Dict[str, Any], prediction: str) -> Dict[str, Any]:
    """
    Calls Fine-tuned HF Inference Endpoint and returns parsed JSON.
    Never throws — always returns a dict.
    """
    try:
        return call_finetuned_endpoint(event_data, prediction)
    except Exception as e:
        return {
            "explanation_paragraph": "LLM call failed.",
            "risk_level": "UNKNOWN",
            "error": str(e)
        }

# # backend/llm.py
# import json
# import re
# from typing import Any, Dict, Tuple
# from llm_client import call_finetuned_endpoint, client

# #from llm_client import client

# PROMPT_VERSION = "v1.0-json-compact"

# MODEL_NAME = "meta-llama/Llama-3.2-3B-Instruct"

# #JSON_SCHEMA_HINT = """{"commuter_summary":"","operator_note":"","suggested_action":"","risk_level":"low|medium|high"}"""
# JSON_SCHEMA_HINT = """{"explanation_paragraph":"","commuter_summary":"","operator_note":"","suggested_action":"","risk_level":"low|medium|high"}"""

# def _extract_json_block(text: str) -> Tuple[bool, str]:
#     """
#     Extract the first {...} JSON-like block.
#     Returns (found, json_text).
#     """
#     if not text:
#         return False, ""
#     match = re.search(r"\{.*\}", text, re.DOTALL)
#     if not match:
#         return False, ""
#     return True, match.group(0)


# def generate_explanation(event_data: Dict[str, Any], prediction: str) -> Dict[str, Any]:
#     """
#     Calls Finetuned LLM and returns a parsed JSON dict.
#     """
#     try:
#         # Step 3 — Switch to finetuned endpoint
#      llm_json = call_finetuned_endpoint(event_data, prediction)
#         return llm_json

#     except Exception as e:
#         return {
#             "error": f"LLM generation or parsing failed: {str(e)}"
#         }

