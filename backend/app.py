import os
import time
import json
from pathlib import Path

import requests
import pandas as pd
import joblib

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from datetime import datetime
from uuid import uuid4
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from llm import generate_explanation, MODEL_NAME, PROMPT_VERSION
from llm_client import call_finetuned_endpoint
from logging_utils import log_llm_call
from eval import evaluate_llm_logs
from catboost import CatBoostClassifier

# ------------------------
# App Setup
# ------------------------
app = FastAPI(title="Traffic Lane State Predictor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()
OPEN511_API_KEY = os.getenv("OPEN511_API_KEY", "")


# ------------------------
# Paths / Models
# ------------------------
ROOT = Path(__file__).resolve().parents[1]   # Thesis/
MODELS_DIR = ROOT / "models"

CB_PATH = MODELS_DIR / "catboost_lane_state_model.cbm"
RF_PATH = MODELS_DIR / "random_forest_lane_state.joblib"

CB_METRICS_PATH = MODELS_DIR / "catboost_metrics.json"
RF_METRICS_PATH = MODELS_DIR / "rf_metrics.json"
BACKEND_DIR = Path(__file__).resolve().parent
LOGS_DIR = BACKEND_DIR / "logs"
HISTORY_PATH = LOGS_DIR / "prediction_history.json"

FEATURES = [
    "event_type",
    "event_subtype",
    "severity",
    "lane_impact_binary",
    "created_hour",
    "is_weekend",
    "is_night",
    "planned_duration_hours",
]


def to_scalar_str(x) -> str:
    """Convert model outputs like [['SOME_LANES_CLOSED']] or ['SOME_LANES_CLOSED'] into 'SOME_LANES_CLOSED'."""
    try:
        # Keep unwrapping while it's list/tuple/ndarray-like
        while hasattr(x, "__len__") and not isinstance(x, (str, bytes)) and len(x) == 1:
            x = x[0]
    except Exception:
        pass
    return str(x)

def ensure_history_file():
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    if not HISTORY_PATH.exists():
        HISTORY_PATH.write_text("[]", encoding="utf-8")


def read_history():
    ensure_history_file()
    try:
        return json.loads(HISTORY_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []


def append_history(record: dict):
    history = read_history()
    history.append(record)
    HISTORY_PATH.write_text(json.dumps(history, indent=2), encoding="utf-8")


def clear_history():
    ensure_history_file()
    HISTORY_PATH.write_text("[]", encoding="utf-8")


def delete_history_item(item_id: str):
    history = read_history()
    new_history = [item for item in history if item.get("id") != item_id]

    if len(new_history) == len(history):
        return False

    HISTORY_PATH.write_text(json.dumps(new_history, indent=2), encoding="utf-8")
    return True

# Load models (safe startup even if files missing)
cat_model = None
if CB_PATH.exists():
    cat_model = CatBoostClassifier()
    cat_model.load_model(str(CB_PATH))

rf_model = None
if RF_PATH.exists():
    rf_model = joblib.load(RF_PATH)

# Load metrics
cb_metrics = json.loads(CB_METRICS_PATH.read_text()) if CB_METRICS_PATH.exists() else {}
rf_metrics = json.loads(RF_METRICS_PATH.read_text()) if RF_METRICS_PATH.exists() else {}


# ------------------------
# Schemas
# ------------------------
class PredictRequest(BaseModel):
    model: str = Field(default="both", description="catboost | rf | both")

    event_type: str
    event_subtype: str
    severity: str

    lane_impact_binary: int
    created_hour: int
    is_weekend: int
    is_night: int
    planned_duration_hours: float


# ------------------------
# Routes
# ------------------------
@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/metrics")
def metrics():
    return {
        "catboost_accuracy": cb_metrics.get("catboost_accuracy"),
        "rf_accuracy": rf_metrics.get("rf_accuracy"),
        "cat_model_loaded": cat_model is not None,
        "rf_model_loaded": rf_model is not None,
    }


@app.get("/live-events")
def live_events(status: str = "active", fmt: str = "json"):
    """
    Proxies 511 Traffic Events API safely (handles UTF-8 BOM).
    """
    if not OPEN511_API_KEY:
        raise HTTPException(status_code=500, detail="OPEN511_API_KEY missing in backend/.env")

    url = "https://api.511.org/traffic/events"
    params = {"api_key": OPEN511_API_KEY, "format": fmt, "status": status}

    try:
        r = requests.get(url, params=params, timeout=15)
        r.raise_for_status()

        text = r.content.decode("utf-8-sig")  # removes BOM
        data = json.loads(text)
        return data

    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Failed to reach 511 API: {str(e)}")
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"Invalid JSON from 511 API: {str(e)}")


@app.get("/llm/eval")
def llm_eval():
    """
    Reads logs/llm_calls.jsonl and returns reliability + latency metrics.
    """
    return evaluate_llm_logs()

@app.get("/history")
def get_history():
    return {
        "count": len(read_history()),
        "items": read_history()
    }


@app.delete("/history")
def delete_history():
    clear_history()
    return {"message": "Prediction history cleared successfully"}

@app.delete("/history/{item_id}")
def delete_history_by_id(item_id: str):
    deleted = delete_history_item(item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="History item not found")

    return {"message": f"History item {item_id} deleted successfully"}


@app.post("/predict")
def predict(req: PredictRequest):
    # ------------------------
    # Build feature row
    # ------------------------
    row = {
        "event_type": req.event_type or "MISSING",
        "event_subtype": req.event_subtype or "MISSING",
        "severity": req.severity or "MISSING",
        "lane_impact_binary": int(req.lane_impact_binary),
        "created_hour": int(req.created_hour),
        "is_weekend": int(req.is_weekend),
        "is_night": int(req.is_night),
        "planned_duration_hours": float(req.planned_duration_hours),
    }

    X = pd.DataFrame([row], columns=FEATURES)

    out = {
        "features_used": row,
        "accuracies": {
            "catboost": cb_metrics.get("catboost_accuracy"),
            "rf": rf_metrics.get("rf_accuracy"),
        },
    }

    final_prediction = None

    # ------------------------
    # CatBoost Prediction + Probabilities
    # ------------------------
    if req.model in ["catboost", "both"]:
        if cat_model is None:
            out["catboost"] = {
                "error": "CatBoost model not found. Place catboost_lane_state_model.cbm in models/"
            }
        else:
            pred_cb = cat_model.predict(X)
            pred_cb = to_scalar_str(pred_cb)

            proba = cat_model.predict_proba(X)[0]
            classes = cat_model.classes_.tolist()
            probs = {str(classes[i]): float(proba[i]) for i in range(len(classes))}

            out["catboost"] = {
                "predicted_lane_state": pred_cb,
                "probabilities": probs,
            }

            final_prediction = pred_cb

    # ------------------------
    # RandomForest Prediction + Probabilities
    # ------------------------
    if req.model in ["rf", "both"]:
        if rf_model is None:
            out["rf"] = {
                "error": "RF model not found. Train RF and save random_forest_lane_state.joblib"
            }
        else:
            pred_rf = rf_model.predict(X)[0]

            out_rf = {"predicted_lane_state": str(pred_rf)}

            # Optional probabilities for thesis comparison
            if hasattr(rf_model, "predict_proba"):
                proba_rf = rf_model.predict_proba(X)[0]
                classes_rf = rf_model.classes_.tolist()
                probs_rf = {str(classes_rf[i]): float(proba_rf[i]) for i in range(len(classes_rf))}
                out_rf["probabilities"] = probs_rf

            out["rf"] = out_rf

            if final_prediction is None:
                final_prediction = str(pred_rf)

    # ------------------------
    # LLM Explanation + Logging
    # ------------------------
    if final_prediction:
        t0 = time.time()
        # Step 4 — Call finetuned endpoint directly or via generate_explanation
        llm_result = call_finetuned_endpoint(row, final_prediction)
        latency_ms = int((time.time() - t0) * 1000)

        # out["llm_explanation"] = llm_result
        # Ensure llm_explanation is only the clean output
        out["llm_explanation"] = {
            "explanation_paragraph": llm_result.get("explanation_paragraph", ""),
            "risk_level": llm_result.get("risk_level", "UNKNOWN"),
            "_latency_ms": llm_result.get("_latency_ms", latency_ms),
        }
        out["llm_latency_ms"] = latency_ms

        # Add requested fields for Step 4
        out["prediction"] = final_prediction
        out["llm"] = llm_result
        out["event_data"] = row

        log_llm_call({
            "endpoint": "/predict",
            "model_name": "Finetuned-Endpoint",
            "prompt_version": PROMPT_VERSION,
            "event_data": row,
            "final_prediction": final_prediction,
            "llm_response": llm_result,
            "latency_ms": latency_ms,
        })

    history_record = {
    "id": str(uuid4()),
    "timestamp": datetime.utcnow().isoformat() + "Z",
    "selected_model": req.model,
    "features_used": row,
    "prediction": out.get("prediction"),
    "catboost": out.get("catboost"),
    "rf": out.get("rf"),
    "llm_explanation": out.get("llm_explanation"),
    "llm_latency_ms": out.get("llm_latency_ms"),
}

    append_history(history_record)

    return out

