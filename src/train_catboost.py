import matplotlib.pyplot as plt
from pathlib import Path

import pandas as pd
from catboost import CatBoostClassifier, Pool
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, ConfusionMatrixDisplay

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
    DATA_PATH = Path("../data/historic_events_cleaned.csv")
    MODELS_DIR = Path("../models")
    MODELS_DIR.mkdir(exist_ok=True)

    df = pd.read_csv(DATA_PATH)

    X = df[FEATURES].copy()
    y = df[TARGET].copy()

    # 70/30 split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.30, random_state=42, stratify=y
    )

    # categorical column indices
    cat_feature_indices = [X.columns.get_loc(col) for col in CATEGORICAL]

    train_pool = Pool(X_train, y_train, cat_features=cat_feature_indices)
    test_pool = Pool(X_test, y_test, cat_features=cat_feature_indices)

    model = CatBoostClassifier(
        loss_function="MultiClass",
        eval_metric="TotalF1",
        iterations=800,
        depth=8,
        learning_rate=0.08,
        random_seed=42,
        verbose=100
    )

    model.fit(train_pool, eval_set=test_pool)

    preds = model.predict(test_pool).flatten()

    print("\nCATBOOST RESULTS:\n")
    print(classification_report(y_test, preds))

    cm = confusion_matrix(y_test, preds, labels=model.classes_)
    print("\nCONFUSION MATRIX:\n")
    print(cm)

    disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=model.classes_)
    disp.plot(cmap="Blues", xticks_rotation=30)
    plt.title("CatBoost Confusion Matrix")
    plt.tight_layout()
    plt.savefig(MODELS_DIR / "catboost_confusion_matrix.png", dpi=300)
    plt.close()

    print("\nSaved confusion matrix ->", MODELS_DIR / "catboost_confusion_matrix.png")

    fi = model.get_feature_importance(prettified=True)
    print("\nFEATURE IMPORTANCE:\n")
    print(fi)

    model.save_model(MODELS_DIR / "catboost_lane_state_model.cbm")
    print("\nSaved model ->", MODELS_DIR / "catboost_lane_state_model.cbm")


if __name__ == "__main__":
    main()