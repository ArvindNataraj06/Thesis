# traffic_model/training/train_catboost.py

import json
from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
from catboost import CatBoostClassifier


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "historic_events_cleaned.csv"
MODELS_DIR = ROOT / "models"
MODELS_DIR.mkdir(exist_ok=True)

TARGET = "lane_state"

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

CATEGORICAL = ["event_type", "event_subtype", "severity"]


def main():
    df = pd.read_csv(DATA_PATH)

    X = df[FEATURES].copy()
    y = df[TARGET].copy()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.30,
        random_state=42,
        stratify=y
    )

    cat_idx = [X_train.columns.get_loc(c) for c in CATEGORICAL]

    model = CatBoostClassifier(
        iterations=1200,
        learning_rate=0.08,
        depth=8,
        loss_function="MultiClass",
        eval_metric="Accuracy",
        random_seed=42,
        verbose=100
    )

    model.fit(X_train, y_train, cat_features=cat_idx)

    y_pred = model.predict(X_test)
    # Sometimes returns [[label]] — flatten safely
    y_pred = [p[0] if isinstance(p, (list, tuple)) else p for p in y_pred]

    acc = accuracy_score(y_test, y_pred)

    print("\n✅ CatBoost Accuracy:", round(acc * 100, 2), "%")
    print("\nClassification report:\n", classification_report(y_test, y_pred))

    # Save model
    out_path = MODELS_DIR / "catboost_lane_state_model.cbm"
    model.save_model(str(out_path))

    metrics = {
        "catboost_accuracy": float(acc),
        "features": FEATURES,
        "categorical": CATEGORICAL,
    }
    (MODELS_DIR / "catboost_metrics.json").write_text(json.dumps(metrics, indent=2))

    print("\n📦 Saved model to:", out_path)
    print("📦 Saved metrics to:", MODELS_DIR / "catboost_metrics.json")


if __name__ == "__main__":
    main()
