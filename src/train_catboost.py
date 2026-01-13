from feature_engineering import load_and_engineer
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
from catboost import CatBoostClassifier, Pool
import pandas as pd


def main():
    df, feature_cols, categorical_features, target = load_and_engineer("data/historic_events.csv")
    X = df[feature_cols]
    y = df[target]

    # 70/30 split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.30, random_state=42, stratify=y
    )

    # Tell CatBoost which columns are categorical (by index)
    cat_feature_indices = [X.columns.get_loc(col) for col in categorical_features]

    train_pool = Pool(X_train, y_train, cat_features=cat_feature_indices)
    test_pool  = Pool(X_test,  y_test,  cat_features=cat_feature_indices)

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

    print("\nCONFUSION MATRIX:\n")
    print(confusion_matrix(y_test, preds))

    # Feature importance table
    fi = model.get_feature_importance(prettified=True)
    print("\nFEATURE IMPORTANCE:\n")
    print(fi)

    # Save model
    model.save_model("models/catboost_lane_state_model.cbm")
    print("\nSaved model -> models/catboost_lane_state_model.cbm")


if __name__ == "__main__":
    main()
