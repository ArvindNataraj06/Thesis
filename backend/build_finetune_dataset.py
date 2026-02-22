import json
import random
from pathlib import Path
from typing import Dict, Any, List, Tuple


# -------- Paths --------
ROOT = Path(__file__).resolve().parents[1]  # Thesis/
LOG_PATH = ROOT / "logs" / "llm_calls.jsonl"

OUT_DIR = Path(__file__).resolve().parent / "finetune_data"  # backend/finetune_data/
OUT_DIR.mkdir(parents=True, exist_ok=True)

TRAIN_PATH = OUT_DIR / "train.jsonl"
VAL_PATH = OUT_DIR / "val.jsonl"

SEED = 42
random.seed(SEED)


# -------- Helper: risk mapping (simple + consistent) --------
def compute_risk_level(lane_state: str, severity: str) -> str:
    lane_state = (lane_state or "").strip().upper()
    severity = (severity or "").strip().lower()

    # Strong rule: fully closed is high risk
    if lane_state == "CLOSED":
        return "high"

    # Some lanes closed: depends on severity
    if lane_state == "SOME_LANES_CLOSED":
        if severity in ["major", "severe", "high"]:
            return "high"
        if severity in ["minor", "low"]:
            return "medium"
        return "medium"  # moderate/unknown -> medium

    # Fallback
    return "medium"


# -------- Helper: create a clean paragraph (simple English) --------
def build_paragraph(event_data: Dict[str, Any], lane_state: str, risk: str) -> str:
    subtype = event_data.get("event_subtype", "an incident")
    severity = event_data.get("severity", "unknown severity")
    hour = event_data.get("created_hour", None)

    time_hint = ""
    if isinstance(hour, int):
        if 7 <= hour <= 10 or 16 <= hour <= 19:
            time_hint = " This happened during a busy time, so delays can be more noticeable."
        else:
            time_hint = " Traffic may still slow down around the area."

    lane_text = "some lanes are affected" if lane_state == "SOME_LANES_CLOSED" else "lanes are affected"
    if lane_state == "CLOSED":
        lane_text = "the road may be fully blocked or closed"

    risk_text = {
        "low": "low",
        "medium": "medium",
        "high": "high",
    }.get(risk, "medium")

    paragraph = (
        f"There is {severity.lower()} {subtype.lower()}, and {lane_text}. "
        f"Please expect slow traffic and follow updates from your navigation app or local traffic alerts."
        f"{time_hint} Consider an alternate route if possible. Overall risk level is {risk_text}."
    )
    return paragraph


# -------- Prompt template for fine-tuning --------
def build_user_prompt(event_data: Dict[str, Any], lane_state: str) -> str:
    schema = '{"explanation_paragraph":"...","risk_level":"low|medium|high"}'
    return (
        "You are a traffic assistant.\n"
        "Task: Explain the predicted lane impact in simple English (slightly detailed) and give a risk level.\n"
        "Return STRICT valid JSON only (no markdown, no extra text). Close JSON properly.\n"
        f"Schema: {schema}\n\n"
        "Event Data (JSON):\n"
        f"{json.dumps(event_data, ensure_ascii=False)}\n\n"
        f"Predicted lane_state: {lane_state}\n"
    )


def read_logs(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"Log file not found: {path}")
    rows = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except Exception:
                # skip corrupted line
                continue
    return rows


def build_examples(log_rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    examples = []
    skipped = 0

    for row in log_rows:
        event_data = row.get("event_data")
        lane_state = row.get("final_prediction")

        if not isinstance(event_data, dict) or not lane_state:
            skipped += 1
            continue

        # Normalize lane_state strings
        lane_state = str(lane_state).strip()
        # handle legacy like "['SOME_LANES_CLOSED']"
        lane_state = lane_state.replace("[", "").replace("]", "").replace("'", "").replace('"', "").strip()

        severity = str(event_data.get("severity", "")).strip()
        risk = compute_risk_level(lane_state, severity)

        paragraph = build_paragraph(event_data, lane_state, risk)
        user_prompt = build_user_prompt(event_data, lane_state)

        assistant_json = {
            "explanation_paragraph": paragraph,
            "risk_level": risk,
        }

        examples.append({
            "messages": [
                {"role": "user", "content": user_prompt},
                {"role": "assistant", "content": json.dumps(assistant_json, ensure_ascii=False)},
            ]
        })

    print(f"Loaded logs: {len(log_rows)}")
    print(f"Built examples: {len(examples)}")
    print(f"Skipped: {skipped}")
    return examples


def write_jsonl(path: Path, records: List[Dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as f:
        for rec in records:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def main(val_ratio: float = 0.15) -> None:
    logs = read_logs(LOG_PATH)
    examples = build_examples(logs)

    if len(examples) < 10:
        raise RuntimeError("Not enough examples generated. Please generate more logs first.")

    random.shuffle(examples)
    n_val = max(1, int(len(examples) * val_ratio))
    val = examples[:n_val]
    train = examples[n_val:]

    write_jsonl(TRAIN_PATH, train)
    write_jsonl(VAL_PATH, val)

    print("\n✅ Dataset created:")
    print(f"  Train: {TRAIN_PATH}  ({len(train)} examples)")
    print(f"  Val:   {VAL_PATH}  ({len(val)} examples)")
    print("\nNext: upload these files to Colab for fine-tuning.")


if __name__ == "__main__":
    main()