import os
import requests
from dotenv import load_dotenv
from fastapi import HTTPException
import json


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from catboost import CatBoostClassifier
import joblib
import json
import pandas as pd
from pathlib import Path

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

@app.get("/live-events")
def live_events(status: str = "active", fmt: str = "json"):
    """
    Proxies 511 Traffic Events API safely (handles UTF-8 BOM).
    """
    if not OPEN511_API_KEY:
        raise HTTPException(status_code=500, detail="OPEN511_API_KEY missing in backend/.env")

    url = "https://api.511.org/traffic/events"
    params = {
        "api_key": OPEN511_API_KEY,
        "format": fmt,
        "status": status,
    }

    try:
        r = requests.get(url, params=params, timeout=15)
        r.raise_for_status()

        # 🔑 FIX: decode with utf-8-sig to remove BOM
        text = r.content.decode("utf-8-sig")
        data = json.loads(text)

        return data

    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Failed to reach 511 API: {str(e)}")
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"Invalid JSON from 511 API: {str(e)}")

# ---------- CORS (needed for React -> FastAPI) ----------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for demo; later restrict to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ROOT = Path(__file__).resolve().parents[1]  # traffic_model/
MODELS_DIR = ROOT / "models"

CB_PATH = MODELS_DIR / "catboost_lane_state_model.cbm"
RF_PATH = MODELS_DIR / "random_forest_lane_state.joblib"

CB_METRICS_PATH = MODELS_DIR / "catboost_metrics.json"
RF_METRICS_PATH = MODELS_DIR / "rf_metrics.json"

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

# ---------- Load models ----------
# Load CatBoost model only if model file exists. If not present, keep `cat_model` None
# so the API can still start (useful for local dev without the heavy model files).
cat_model = None
if CB_PATH.exists():
    cat_model = CatBoostClassifier()
    cat_model.load_model(str(CB_PATH))

rf_model = None
if RF_PATH.exists():
    rf_model = joblib.load(RF_PATH)

# ---------- Load metrics ----------
cb_metrics = json.loads(CB_METRICS_PATH.read_text()) if CB_METRICS_PATH.exists() else {}
rf_metrics = json.loads(RF_METRICS_PATH.read_text()) if RF_METRICS_PATH.exists() else {}


# ---------- Input schema ----------
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


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/metrics")
def metrics():
    return {
        "catboost_accuracy": cb_metrics.get("catboost_accuracy"),
        "rf_accuracy": rf_metrics.get("rf_accuracy"),
        "rf_model_loaded": rf_model is not None,
    }


@app.post("/predict")
def predict(req: PredictRequest):
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

    # --- CatBoost prediction + probabilities ---
    if req.model in ["catboost", "both"]:
        if cat_model is None:
            out["catboost"] = {"error": "CatBoost model not found. Place catboost_lane_state_model.cbm in models/"}
        else:
            pred_cb = cat_model.predict(X)[0]
            if isinstance(pred_cb, (list, tuple)) and len(pred_cb) == 1:
                pred_cb = pred_cb[0]

            proba = cat_model.predict_proba(X)[0]
            classes = cat_model.classes_.tolist()
            probs = {str(classes[i]): float(proba[i]) for i in range(len(classes))}

            out["catboost"] = {
                "predicted_lane_state": str(pred_cb),
                "probabilities": probs,
            }

    # --- RandomForest prediction ---
    if req.model in ["rf", "both"]:
        if rf_model is None:
            out["rf"] = {"error": "RF model not found. Train RF and save random_forest_lane_state.joblib"}
        else:
            pred_rf = rf_model.predict(X)[0]
            out["rf"] = {"predicted_lane_state": str(pred_rf)}

    return out
