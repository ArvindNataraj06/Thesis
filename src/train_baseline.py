from feature_engineering import load_and_engineer
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
import feature_engineering
print("Using feature_engineering from:", feature_engineering.__file__)



def main():
    df, feature_cols, categorical_features, target = load_and_engineer("data/historic_events.csv")
    print("FEATURE COLUMNS USED:", feature_cols)
    print("CATEGORICAL FEATURES USED:", categorical_features)

    X = df[feature_cols]
    y = df[target]

    # 70% train, 30% test
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.30, random_state=42, stratify=y
    )

    # One-hot encode categoricals for Logistic Regression
    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_features),
        ],
        remainder="passthrough"  # keep numeric features as-is
    )

    # model = LogisticRegression(
    #     max_iter=2000,
    #     multi_class="multinomial",
    #     n_jobs=-1
    # )

    model = LogisticRegression(
    max_iter=2000,
    n_jobs=-1
)


    clf = Pipeline(steps=[
        ("preprocess", preprocessor),
        ("model", model)
    ])

    clf.fit(X_train, y_train)
    preds = clf.predict(X_test)

    print("\nBASELINE (Logistic Regression) RESULTS:\n")
    print(classification_report(y_test, preds))


if __name__ == "__main__":
    main()
