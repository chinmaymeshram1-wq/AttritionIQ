"""
ML Training Script — Employee Attrition Risk Intelligence System

Run from the backend/ directory:
    python -m app.ml.train

Outputs:
    app/ml/artifacts/model_v1.pkl
    app/ml/artifacts/feature_names.json
    app/ml/artifacts/training_metrics.json
"""
import os
import re
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_validate
from sklearn.metrics import (
    f1_score, recall_score, precision_score,
    roc_auc_score, average_precision_score,
    confusion_matrix,
)
import warnings
warnings.filterwarnings("ignore")

ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
os.makedirs(ARTIFACTS_DIR, exist_ok=True)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
os.makedirs(DATA_DIR, exist_ok=True)
DATA_PATH = os.path.join(DATA_DIR, "WA_Fn-UseC_-HR-Employee-Attrition.csv")

# ── 1. Load dataset (auto-download if missing) ───────────────────────────────
if not os.path.exists(DATA_PATH):
    print(f"Dataset not found at {DATA_PATH}. Downloading from public mirror...")
    import urllib.request
    dataset_url = "https://raw.githubusercontent.com/nelson-wu/employee-attrition-ml/master/WA_Fn-UseC_-HR-Employee-Attrition.csv"
    urllib.request.urlretrieve(dataset_url, DATA_PATH)
    print(f"✓ Dataset downloaded to {DATA_PATH}")

print("Loading dataset...")
df = pd.read_csv(DATA_PATH)
print(f"  Shape: {df.shape}")

# ── 2. Drop non-informative columns ──────────────────────────────────────────
DROP_COLS = ["EmployeeCount", "Over18", "StandardHours", "EmployeeNumber"]
df = df.drop(columns=DROP_COLS, errors="ignore")

# ── 3. Target encoding ────────────────────────────────────────────────────────
df["Attrition"] = df["Attrition"].map({"No": 0, "Yes": 1})
y = df["Attrition"]
X = df.drop(columns=["Attrition"])


def to_snake(name: str) -> str:
    """CamelCase to snake_case for consistent internal naming."""
    s1 = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub("([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


# ── 4. Feature type identification ───────────────────────────────────────────
numerical_features = X.select_dtypes(include=["int64", "float64"]).columns.tolist()
categorical_features = X.select_dtypes(include=["object", "category"]).columns.tolist()

# Rename to snake_case for consistency with the API layer
X.columns = [to_snake(c) for c in X.columns]
numerical_features = [to_snake(c) for c in numerical_features]
categorical_features = [to_snake(c) for c in categorical_features]

print(f"  Numerical features ({len(numerical_features)}): {numerical_features}")
print(f"  Categorical features ({len(categorical_features)}): {categorical_features}")

# ── 5. Train / test split (80/20 stratified) ─────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
print(f"  Train: {X_train.shape} | Test: {X_test.shape}")
print(f"  Attrition rate — train: {y_train.mean():.3f} | test: {y_test.mean():.3f}")

# ── 6. Preprocessing pipeline ────────────────────────────────────────────────
numerical_transformer = Pipeline(steps=[
    ("imputer", SimpleImputer(strategy="median")),
    ("scaler", StandardScaler()),
])

categorical_transformer = Pipeline(steps=[
    ("imputer", SimpleImputer(strategy="most_frequent")),
    ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
])

preprocessor = ColumnTransformer(
    transformers=[
        ("num", numerical_transformer, numerical_features),
        ("cat", categorical_transformer, categorical_features),
    ]
)

# ── 7. Full pipeline ──────────────────────────────────────────────────────────
pipeline = Pipeline(steps=[
    ("preprocessor", preprocessor),
    ("classifier", LogisticRegression(
        C=0.1,
        class_weight={0: 1, 1: 2},  # upweight minority Attrition=Yes class
        max_iter=1000,
        random_state=42,
        solver="lbfgs",
    )),
])

# ── 8. 5-fold Stratified Cross Validation ────────────────────────────────────
print("\nRunning 5-fold stratified cross-validation...")
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
cv_results = cross_validate(
    pipeline, X_train, y_train, cv=cv,
    scoring=["f1", "recall", "precision", "roc_auc", "average_precision"],
    return_train_score=False,
)

cv_summary = {
    "cv_f1_mean": float(cv_results["test_f1"].mean()),
    "cv_f1_std": float(cv_results["test_f1"].std()),
    "cv_recall_mean": float(cv_results["test_recall"].mean()),
    "cv_recall_std": float(cv_results["test_recall"].std()),
    "cv_precision_mean": float(cv_results["test_precision"].mean()),
    "cv_precision_std": float(cv_results["test_precision"].std()),
    "cv_roc_auc_mean": float(cv_results["test_roc_auc"].mean()),
    "cv_roc_auc_std": float(cv_results["test_roc_auc"].std()),
    "cv_pr_auc_mean": float(cv_results["test_average_precision"].mean()),
    "cv_pr_auc_std": float(cv_results["test_average_precision"].std()),
}
for k, v in cv_summary.items():
    print(f"  {k}: {v:.4f}")

# ── 9. Final training on full train set ──────────────────────────────────────
print("\nFitting final model on full train set...")
pipeline.fit(X_train, y_train)

# ── 10. Hold-out test set evaluation ─────────────────────────────────────────
print("\nTest set evaluation (hold-out — never seen during training):")
y_pred = pipeline.predict(X_test)
y_proba = pipeline.predict_proba(X_test)[:, 1]

test_metrics = {
    "test_f1": float(f1_score(y_test, y_pred)),
    "test_recall": float(recall_score(y_test, y_pred)),
    "test_precision": float(precision_score(y_test, y_pred)),
    "test_roc_auc": float(roc_auc_score(y_test, y_proba)),
    "test_pr_auc": float(average_precision_score(y_test, y_proba)),
    "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
}
for k, v in test_metrics.items():
    if k != "confusion_matrix":
        print(f"  {k}: {v:.4f}")
    else:
        print(f"  {k}: {v}")

# ── 11. Save artifacts ────────────────────────────────────────────────────────
model_path = os.path.join(ARTIFACTS_DIR, "model_v1.pkl")
joblib.dump(pipeline, model_path)
print(f"\n✓ Model saved: {model_path}")

feature_names_path = os.path.join(ARTIFACTS_DIR, "feature_names.json")
with open(feature_names_path, "w") as f:
    json.dump(numerical_features + categorical_features, f, indent=2)
print(f"✓ Feature names saved: {feature_names_path}")

metrics_path = os.path.join(ARTIFACTS_DIR, "training_metrics.json")
all_metrics = {"cross_validation": cv_summary, "test_set": test_metrics}
with open(metrics_path, "w") as f:
    json.dump(all_metrics, f, indent=2)
print(f"✓ Metrics saved: {metrics_path}")
print("\n✓ Training complete. You can now start the API server.")
