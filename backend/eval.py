# backend/eval.py
import json
from pathlib import Path
from statistics import mean

LOG_PATH = Path(__file__).resolve().parents[1] / "logs" / "llm_calls.jsonl"

#REQUIRED_KEYS = {"commuter_summary", "operator_note", "suggested_action", "risk_level"}
REQUIRED_KEYS = {"explanation_paragraph","commuter_summary", "operator_note", "suggested_action", "risk_level"}
ALLOWED_RISK = {"low", "medium", "high"}

# Simple expected risk heuristic by lane_state (you can refine later)
EXPECTED_RISK_BY_LANE_STATE = {
    "CLOSED": {"high"},
    "SOME_LANES_CLOSED": {"medium", "high"},
    "SINGLE_LANE_ALTERNATING": {"medium"},
    # If you have other lane states, add here
}


def _iter_logs():
    if not LOG_PATH.exists():
        return
    with LOG_PATH.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def _pctl(values, p: float):
    if not values:
        return None
    xs = sorted(values)
    idx = int(round(p * (len(xs) - 1)))
    return xs[idx]


def evaluate_llm_logs():
    total = 0

    valid_json = 0
    complete_fields = 0
    valid_risk = 0

    # New: reasoning/alignment checks
    consistency_pass = 0
    consistency_checked = 0

    # New: distributions
    risk_counts = {"low": 0, "medium": 0, "high": 0, "invalid": 0}
    lane_state_counts = {}
    model_counts = {}
    prompt_counts = {}

    # New: latency stats
    latencies = []

    # New: basic content sanity
    avg_lengths = {"commuter_summary": [], "operator_note": [], "suggested_action": []}

    for entry in _iter_logs():
        total += 1

        lane_state = str(entry.get("final_prediction", "")).strip()
        if lane_state:
            lane_state_counts[lane_state] = lane_state_counts.get(lane_state, 0) + 1

        model_name = entry.get("model_name") or "unknown"
        model_counts[model_name] = model_counts.get(model_name, 0) + 1

        prompt_version = entry.get("prompt_version") or "unknown"
        prompt_counts[prompt_version] = prompt_counts.get(prompt_version, 0) + 1

        latency = entry.get("latency_ms")
        if isinstance(latency, int):
            latencies.append(latency)

        resp = entry.get("llm_response", {})

        # Our llm.py returns a dict always. But it may contain "error".
        if isinstance(resp, dict) and "error" not in resp:
            valid_json += 1

            # Field completeness
            if REQUIRED_KEYS.issubset(set(resp.keys())):
                complete_fields += 1

            risk = str(resp.get("risk_level", "")).lower().strip()
            if risk in ALLOWED_RISK:
                valid_risk += 1
                risk_counts[risk] += 1
            else:
                risk_counts["invalid"] += 1

            # Content lengths (helps detect overly short / empty outputs)
            for k in ["commuter_summary", "operator_note", "suggested_action"]:
                v = resp.get(k, "")
                if isinstance(v, str):
                    avg_lengths[k].append(len(v.strip()))

            # Reasoning consistency check (simple heuristic)
            # Only check if we know an expected set for this lane_state AND risk is valid
            if lane_state in EXPECTED_RISK_BY_LANE_STATE and risk in ALLOWED_RISK:
                consistency_checked += 1
                if risk in EXPECTED_RISK_BY_LANE_STATE[lane_state]:
                    consistency_pass += 1

        else:
            # invalid JSON / error dict
            risk_counts["invalid"] += 1

    def safe_mean(xs):
        return int(mean(xs)) if xs else None

    return {
        "total_calls": total,

        # Base reliability
        "valid_json_rate": (valid_json / total) if total else None,
        "complete_fields_rate": (complete_fields / total) if total else None,
        "valid_risk_rate": (valid_risk / total) if total else None,

        # New: reasoning/alignment quality
        "reasoning_consistency_rate": (consistency_pass / consistency_checked) if consistency_checked else None,
        "reasoning_consistency_checked": consistency_checked,

        # New: distributions
        "risk_distribution_counts": risk_counts,
        "lane_state_distribution_counts": lane_state_counts,
        "model_distribution_counts": model_counts,
        "prompt_version_distribution_counts": prompt_counts,

        # Latency stats
        "latency_ms_avg": safe_mean(latencies),
        "latency_ms_p50": _pctl(latencies, 0.50),
        "latency_ms_p95": _pctl(latencies, 0.95),
        "latency_ms_max": max(latencies) if latencies else None,

        # Content sanity stats
        "avg_text_length_chars": {
            "commuter_summary": safe_mean(avg_lengths["commuter_summary"]),
            "operator_note": safe_mean(avg_lengths["operator_note"]),
            "suggested_action": safe_mean(avg_lengths["suggested_action"]),
        },

        "log_path": str(LOG_PATH),
    }