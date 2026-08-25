import json
import math
import os
import pandas as pd


# Maps IBM dataset CSV column names to internal snake_case feature names
COLUMN_MAP = {
    "Age": "age",
    "Gender": "gender",
    "MaritalStatus": "marital_status",
    "Education": "education",
    "EducationField": "education_field",
    "Department": "department",
    "JobRole": "job_role",
    "JobLevel": "job_level",
    "BusinessTravel": "business_travel",
    "OverTime": "overtime",
    "MonthlyIncome": "monthly_income",
    "PercentSalaryHike": "percent_salary_hike",
    "StockOptionLevel": "stock_option_level",
    "TotalWorkingYears": "total_working_years",
    "YearsAtCompany": "years_at_company",
    "YearsInCurrentRole": "years_in_current_role",
    "YearsSinceLastPromotion": "years_since_last_promotion",
    "YearsWithCurrManager": "years_with_curr_manager",
    "NumCompaniesWorked": "num_companies_worked",
    "JobSatisfaction": "job_satisfaction",
    "EnvironmentSatisfaction": "environment_satisfaction",
    "RelationshipSatisfaction": "relationship_satisfaction",
    "WorkLifeBalance": "work_life_balance",
    "JobInvolvement": "job_involvement",
    "DistanceFromHome": "distance_from_home",
    "HourlyRate": "hourly_rate",
    "DailyRate": "daily_rate",
    "MonthlyRate": "monthly_rate",
    "TrainingTimesLastYear": "training_times_last_year",
    "PerformanceRating": "performance_rating",
}

# Load canonical features for complete 30-feature dict construction
_ARTIFACT_DIR = os.path.join(os.path.dirname(__file__), "..", "ml", "artifacts")
_FEATURE_NAMES_PATH = os.path.join(_ARTIFACT_DIR, "feature_names.json")

try:
    with open(_FEATURE_NAMES_PATH, "r") as _f:
        CANONICAL_FEATURES = json.load(_f)
except Exception:
    CANONICAL_FEATURES = list(COLUMN_MAP.values())
    if "overtime" in CANONICAL_FEATURES:
        CANONICAL_FEATURES[CANONICAL_FEATURES.index("overtime")] = "over_time"


def map_csv_row_to_features(row: pd.Series) -> dict:
    """Convert an IBM-style CSV row to the internal feature dict used by the ML pipeline."""
    features = {}
    for csv_col, internal_col in COLUMN_MAP.items():
        if csv_col in row:
            val = row[csv_col]
            # Convert numpy types to Python native for JSON serialization
            if hasattr(val, "item"):
                val = val.item()
            features[internal_col] = val
    return features


def map_row_with_compatibility(
    row: pd.Series,
    mapped_columns: dict,
) -> dict:
    """
    Build an ML feature dict from a CSV row using the column mapping produced
    by ``analyze_csv_compatibility()``.

    Provides all 30 canonical model features:
    - Mapped columns are populated with their converted row values.
    - Missing/unmapped features are set to ``float('nan')`` — NOT zero — so
      the sklearn pipeline's ``SimpleImputer`` (median / most_frequent) handles
      them exactly as it was trained to.

    The ``overtime`` → ``over_time`` normalization expected by the predictor's
    ``_prepare_features()`` is applied here: if the resolved canonical name is
    ``over_time`` we store it under ``overtime`` in the returned dict so the
    predictor's existing renaming step works unchanged.

    Parameters
    ----------
    row : pd.Series
        A single row from the uploaded DataFrame.
    mapped_columns : dict
        ``{upload_col: canonical_name}`` mapping from ``CompatibilityReport``.

    Returns
    -------
    dict
        Feature dict containing all 30 features ready to pass to ``AttritionPredictor.predict_proba()``.
    """
    canonical_to_upload = {canonical: upload_col for upload_col, canonical in mapped_columns.items()}
    features: dict = {}

    for canonical_name in CANONICAL_FEATURES:
        api_key = "overtime" if canonical_name == "over_time" else canonical_name
        upload_col = canonical_to_upload.get(canonical_name)

        if upload_col is not None and upload_col in row.index:
            val = row[upload_col]
            if hasattr(val, "item"):
                val = val.item()

            is_empty = False
            try:
                if val is None or (isinstance(val, float) and math.isnan(val)) or val == "" or str(val).strip().lower() in ("nan", "none", "null", "n/a"):
                    is_empty = True
            except (TypeError, ValueError):
                pass

            if is_empty:
                features[api_key] = float("nan")
            else:
                features[api_key] = val
        else:
            # Missing feature -> explicitly set to float("nan") for SimpleImputer
            features[api_key] = float("nan")

    return features
