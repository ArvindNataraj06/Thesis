import json
import itertools
import numpy as np
import pandas as pd
from pathlib import Path

from sklearn.model_selection import StratifiedKFold, RandomizedSearchCV
from sklearn.metrics import accuracy_score, f1_score, balanced_accuracy_score
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestClassifier

from catboost import CatBoostClassifier


# -------------------------
# Paths
# -------------------------
ROOT = Path(__file__).resolve().parents[1]  # Thesis/
DATA_PATH = ROOT / "data" / "historic_events_cleaned.csv"
OUT_DIR = ROOT / "traffic_model" / "models"
OUT_DIR.mkdir(parents=True, exist_ok=True)

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


def score_fold(y_true, y_pred):
    return {
        "acc": float(accuracy_score(y_true, y_pred)),
        "macro_f1": float(f1_score(y_true, y_pred, average="macro")),
        "weighted_f1": float(f1_score(y_true, y_pred, average="weighted")),
        "bal_acc": float(balanced_accuracy_score(y_true, y_pred)),
    }


def mean_std(scores_list, key):
    vals = np.array([s[key] for s in scores_list], dtype=float)
    return float(vals.mean()), float(vals.std())


def tune_random_forest(X, y, cv):
    print("\n==============================")
    print("TUNING: Random Forest (RandomizedSearchCV)")
    print("==============================")

    pre = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL),
            ("num", Pipeline([("imputer", SimpleImputer(strategy="constant", fill_value=0))]), NUMERIC),
        ]
    )

    rf = RandomForestClassifier(
        random_state=42,
        n_jobs=-1,
        class_weight="balanced",
    )

    pipe = Pipeline([("pre", pre), ("rf", rf)])

    # Randomized search space (small + meaningful)
    param_distributions = {
        "rf__n_estimators": [300, 500, 700, 900],
        "rf__max_depth": [None, 10, 14, 18, 24],
        "rf__min_samples_split": [2, 5, 10],
        "rf__min_samples_leaf": [1, 2, 4],
        "rf__max_features": ["sqrt", "log2", 0.5],
    }

    search = RandomizedSearchCV(
        estimator=pipe,
        param_distributions=param_distributions,
        n_iter=18,                 # increase later if you want (e.g., 40)
        scoring="f1_macro",        # key metric for multiclass fairness
        cv=cv,
        verbose=2,
        n_jobs=-1,
        random_state=42,
        refit=True,
    )

    search.fit(X, y)

    best_params = search.best_params_
    best_score = float(search.best_score_)

    print("\n✅ RF Best CV macro-F1:", best_score)
    print("✅ RF Best Params:", best_params)

    return {
        "best_params": best_params,
        "best_cv_macro_f1": best_score,
    }
def tune_catboost_manual_cv(X, y, cv):
    print("\n==============================")
    print("TUNING: CatBoost (FAST random CV + early stopping)")
    print("==============================")

    cat_idx = [X.columns.get_loc(c) for c in CATEGORICAL]

    # Try only 18 random configs instead of 81 (huge speed-up)
    rng = np.random.RandomState(42)

    depths = [4, 6, 8, 10]
    lrs = [0.03, 0.05, 0.08, 0.1]
    regs = [3, 6, 10, 15]
    iters = [400, 600, 900]  # smaller iterations
    configs = []
    for _ in range(18):
        configs.append({
            "depth": int(rng.choice(depths)),
            "learning_rate": float(rng.choice(lrs)),
            "l2_leaf_reg": int(rng.choice(regs)),
            "iterations": int(rng.choice(iters)),
        })

    best = None

    for i, params in enumerate(configs, start=1):
        fold_scores = []

        for train_idx, test_idx in cv.split(X, y):
            X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
            y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

            model = CatBoostClassifier(
                loss_function="MultiClass",
                random_seed=42,
                verbose=False,
                # Early stopping makes it much faster
                od_type="Iter",
                od_wait=50,
                **params
            )

            model.fit(
                X_train, y_train,
                cat_features=cat_idx,
                eval_set=(X_test, y_test),
                use_best_model=True
            )

            pred = model.predict(X_test)
            pred = [p[0] if isinstance(p, (list, tuple)) else p for p in pred]
            fold_scores.append(score_fold(y_test, pred))

        acc_mean, acc_std = mean_std(fold_scores, "acc")
        macro_mean, macro_std = mean_std(fold_scores, "macro_f1")

        print(f"[{i:02d}/{len(configs)}] macroF1={macro_mean:.6f}±{macro_std:.6f}  acc={acc_mean:.6f}±{acc_std:.6f}  params={params}")

        if best is None or macro_mean > best["macro_f1_mean"]:
            best = {
                "params": params,
                "acc_mean": acc_mean,
                "acc_std": acc_std,
                "macro_f1_mean": macro_mean,
                "macro_f1_std": macro_std,
            }

    print("\n✅ CatBoost Best Params:", best["params"])
    print("✅ CatBoost Best CV macro-F1:", best["macro_f1_mean"], "±", best["macro_f1_std"])

    return {"best": best}


# def tune_catboost_manual_cv(X, y, cv):
#     print("\n==============================")
#     print("TUNING: CatBoost (Manual CV loop)")
#     print("==============================")

#     cat_idx = [X.columns.get_loc(c) for c in CATEGORICAL]

#     # Small grid (fast + effective). You can expand later.
#     grid = {
#         "depth": [6, 8, 10],
#         "learning_rate": [0.03, 0.06, 0.1],
#         "l2_leaf_reg": [3, 6, 10],
#         "iterations": [600, 900, 1200],
#     }

#     keys = list(grid.keys())
#     combos = list(itertools.product(*[grid[k] for k in keys]))

#     best = None
#     all_results = []

#     for i, vals in enumerate(combos, start=1):
#         params = dict(zip(keys, vals))

#         fold_scores = []
#         for train_idx, test_idx in cv.split(X, y):
#             X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
#             y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

#             model = CatBoostClassifier(
#                 loss_function="MultiClass",
#                 eval_metric="Accuracy",
#                 random_seed=42,
#                 verbose=False,
#                 **params
#             )

#             model.fit(X_train, y_train, cat_features=cat_idx)

#             pred = model.predict(X_test)
#             pred = [p[0] if isinstance(p, (list, tuple)) else p for p in pred]

#             fold_scores.append(score_fold(y_test, pred))

#         acc_mean, acc_std = mean_std(fold_scores, "acc")
#         macro_mean, macro_std = mean_std(fold_scores, "macro_f1")
#         bal_mean, bal_std = mean_std(fold_scores, "bal_acc")

#         res = {
#             "params": params,
#             "acc_mean": acc_mean,
#             "acc_std": acc_std,
#             "macro_f1_mean": macro_mean,
#             "macro_f1_std": macro_std,
#             "bal_acc_mean": bal_mean,
#             "bal_acc_std": bal_std,
#         }
#         all_results.append(res)

#         print(
#             f"[{i:02d}/{len(combos)}] "
#             f"macroF1={macro_mean:.6f}±{macro_std:.6f}  "
#             f"acc={acc_mean:.6f}±{acc_std:.6f}  params={params}"
#         )

#         if best is None or macro_mean > best["macro_f1_mean"]:
#             best = res

#     print("\n✅ CatBoost Best Params:", best["params"])
#     print("✅ CatBoost Best CV macro-F1:", best["macro_f1_mean"], "±", best["macro_f1_std"])

#     return {
#         "best": best,
#         "all_results": all_results,  # can be large; still useful for thesis appendix
#     }


def main():
    df = pd.read_csv(DATA_PATH)
    X = df[FEATURES].copy()
    y = df[TARGET].copy()

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    rf_out = tune_random_forest(X, y, cv)
    cb_out = tune_catboost_manual_cv(X, y, cv)

    out = {
        "rf_tuning": rf_out,
        "catboost_tuning": {
            "best": cb_out["best"],
        },
    }

    out_path = OUT_DIR / "tuning_results.json"
    out_path.write_text(json.dumps(out, indent=2))
    print("\n📦 Saved tuning summary to:", out_path)

    print("\n==============================")
    print("SUMMARY (Best macro-F1)")
    print("==============================")
    print("RF best macro-F1:", rf_out["best_cv_macro_f1"])
    print("CatBoost best macro-F1:", cb_out["best"]["macro_f1_mean"])
    print("\nNext step: train final models with the best params on full train split and save.")


if __name__ == "__main__":
    main()
