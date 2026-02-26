import numpy as np
import pandas as pd
from pathlib import Path

from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestClassifier

from catboost import CatBoostClassifier

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "historic_events_cleaned.csv"

TARGET = "lane_state"
FEATURES = [
    "event_type","event_subtype","severity",
    "lane_impact_binary","created_hour","is_weekend","is_night","planned_duration_hours"
]
CATEGORICAL = ["event_type","event_subtype","severity"]
NUMERIC = ["lane_impact_binary","created_hour","is_weekend","is_night","planned_duration_hours"]

def main():
    df = pd.read_csv(DATA_PATH)
    X = df[FEATURES].copy()
    y = df[TARGET].copy()

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    scoring = {
        "acc": "accuracy",
        "macro_f1": "f1_macro",
        "weighted_f1": "f1_weighted",
        "bal_acc": "balanced_accuracy",
    }

    # ---- Random Forest pipeline ----
    pre = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL),
            ("num", Pipeline([("imputer", SimpleImputer(strategy="constant", fill_value=0))]), NUMERIC),
        ]
    )
    rf = RandomForestClassifier(
        n_estimators=400,
        random_state=42,
        class_weight="balanced",
        n_jobs=-1
    )
    rf_model = Pipeline([("pre", pre), ("rf", rf)])

    rf_scores = cross_validate(rf_model, X, y, cv=cv, scoring=scoring, n_jobs=-1)
    print("\n--- Random Forest (5-fold CV) ---")
    for k in scoring:
        vals = rf_scores[f"test_{k}"]
        print(f"{k}: {vals.mean():.6f} ± {vals.std():.6f}")

    # ---- CatBoost (handles categorical directly) ----
    cat_idx = [X.columns.get_loc(c) for c in CATEGORICAL]
    cb_model = CatBoostClassifier(
        iterations=1200,
        learning_rate=0.08,
        depth=8,
        loss_function="MultiClass",
        random_seed=42,
        verbose=False
    )

    # manual CV for CatBoost (because it needs cat_features indices per fold)
    cb_acc, cb_macro, cb_weighted, cb_bal = [], [], [], []
    from sklearn.metrics import accuracy_score, f1_score, balanced_accuracy_score

    for train_idx, test_idx in cv.split(X, y):
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

        m = cb_model.copy()
        m.fit(X_train, y_train, cat_features=cat_idx)

        pred = m.predict(X_test)
        pred = [p[0] if isinstance(p, (list, tuple)) else p for p in pred]

        cb_acc.append(accuracy_score(y_test, pred))
        cb_macro.append(f1_score(y_test, pred, average="macro"))
        cb_weighted.append(f1_score(y_test, pred, average="weighted"))
        cb_bal.append(balanced_accuracy_score(y_test, pred))

    print("\n--- CatBoost (5-fold CV) ---")
    print(f"acc: {np.mean(cb_acc):.6f} ± {np.std(cb_acc):.6f}")
    print(f"macro_f1: {np.mean(cb_macro):.6f} ± {np.std(cb_macro):.6f}")
    print(f"weighted_f1: {np.mean(cb_weighted):.6f} ± {np.std(cb_weighted):.6f}")
    print(f"bal_acc: {np.mean(cb_bal):.6f} ± {np.std(cb_bal):.6f}")

if __name__ == "__main__":
    main()
