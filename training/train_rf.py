# traffic_model/training/train_rf.py

import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, classification_report
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer


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
NUMERIC = ["lane_impact_binary", "created_hour", "is_weekend", "is_night", "planned_duration_hours"]


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

    pre = ColumnTransformer(
    transformers=[
        ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL),
        ("num", Pipeline(steps=[
            ("imputer", SimpleImputer(strategy="constant", fill_value=0)),
        ]), NUMERIC),
    ]
)


    # rf = RandomForestClassifier(
    #     n_estimators=400,
    #     random_state=42,
    #     class_weight="balanced",
    #     n_jobs=-1
    # )
    rf = RandomForestClassifier(
    n_estimators=500,
    max_depth=None,
    max_features=0.5,
    min_samples_split=2,
    min_samples_leaf=1,
    random_state=42,
    class_weight="balanced",
    n_jobs=-1
)


    model = Pipeline([("pre", pre), ("rf", rf)])
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)

    print("\n✅ Random Forest Accuracy:", round(acc * 100, 2), "%")
    print("\nClassification report:\n", classification_report(y_test, y_pred))

    # Save model
    joblib.dump(model, MODELS_DIR / "random_forest_lane_state.joblib")

    # Save metrics (for your meeting + backend /metrics endpoint)
    metrics = {
        "rf_accuracy": float(acc),
        "features": FEATURES,
        "categorical": CATEGORICAL,
        "numeric": NUMERIC,
    }
    (MODELS_DIR / "rf_metrics.json").write_text(json.dumps(metrics, indent=2))

    print("\n📦 Saved model to:", MODELS_DIR / "random_forest_lane_state.joblib")
    print("📦 Saved metrics to:", MODELS_DIR / "rf_metrics.json")


if __name__ == "__main__":
    main()
