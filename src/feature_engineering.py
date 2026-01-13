import pandas as pd
import numpy as np


def load_and_engineer(csv_path: str):
    """
    Loads the raw CSV and creates ML-ready features.

    Returns:
      df_model: cleaned dataframe with features + target
      feature_cols: list of feature column names
      categorical_features: list of categorical feature column names
      target: target column name
    """
    df = pd.read_csv(csv_path)

    # -----------------------------
    # 1) Parse schedule column: "start/end"
    # -----------------------------
    def parse_schedule(value):
        try:
            start_str, end_str = str(value).split("/")
            start = pd.to_datetime(start_str, errors="coerce")
            end = pd.to_datetime(end_str, errors="coerce")
            return start, end
        except:
            return pd.NaT, pd.NaT

    df["schedule_start"], df["schedule_end"] = zip(*df["schedule"].map(parse_schedule))

    # Planned duration in hours
    df["planned_duration_hours"] = (
        (df["schedule_end"] - df["schedule_start"]).dt.total_seconds() / 3600
    )

    # -----------------------------
    # 2) Parse created timestamp and extract time features
    # -----------------------------
    df["created"] = pd.to_datetime(df["created"], errors="coerce")

    df["created_hour"] = df["created"].dt.hour
    df["created_dayofweek"] = df["created"].dt.dayofweek  # Monday=0
    df["is_weekend"] = df["created_dayofweek"].isin([5, 6]).astype(int)
    df["is_night"] = df["created_hour"].isin([22, 23, 0, 1, 2, 3, 4, 5]).astype(int)

    # -----------------------------
    # 3) Define target and features
    # -----------------------------
    target = "lane_state"

    categorical_features = [
    "event_type",
    "event_subtype",
    "severity",
    "area_name"
]

    numeric_features = [
        "latitude",
        "longitude",
        "planned_duration_hours",
        "created_hour",
        "created_dayofweek",
        "is_weekend",
        "is_night",
    ]

    feature_cols = categorical_features + numeric_features

    # Keep only the columns we need
    df_model = df[feature_cols + [target]].copy()

    # Clean up: handle missing values (important!)
    # - CatBoost can handle missing values, but we should keep them consistent.
    for col in categorical_features:
        df_model[col] = df_model[col].astype("string").fillna("MISSING")

    # Numeric: fill NaN with median (simple, stable)
    for col in numeric_features:
        df_model[col] = pd.to_numeric(df_model[col], errors="coerce")
        df_model[col] = df_model[col].fillna(df_model[col].median())

    # Drop rows where target is missing (should be none, but safe)
    df_model = df_model.dropna(subset=[target])

    return df_model, feature_cols, categorical_features, target
