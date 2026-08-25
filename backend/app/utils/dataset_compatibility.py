"""
Dataset Compatibility & Feature Mapping Engine
===============================================
Analyzes an uploaded HR CSV DataFrame and determines how well its columns
map to the 31 canonical features required by the trained model pipeline.

Compatibility states
--------------------
FULLY_COMPATIBLE     — 31/31 model features resolved.
PARTIALLY_COMPATIBLE — 16–30 model features resolved; predictions are
                       allowed using the pipeline's built-in SimpleImputer
                       strategy but must be clearly marked as ESTIMATED /
                       REDUCED CONFIDENCE.
INCOMPATIBLE         — Fewer than 16 model features resolved; no
                       meaningful prediction can be made.

Column-resolution priority (highest → lowest)
----------------------------------------------
1. Exact canonical match  (uploaded col == internal feature name already)
2. Normalized match       (lowercase + spaces/hyphens → underscores)
3. Explicit alias dict    (curated HR-domain aliases, high confidence 0.95)
4. Fuzzy token match      (only when confidence ≥ FUZZY_CONFIDENCE_THRESHOLD;
                           never used for single-word ambiguous cols like "Salary")

Safety constraints
------------------
- Ambiguous columns are NEVER silently mapped; they are left in
  `unrecognized_columns`.
- The existing IBM HR CSV PascalCase → snake_case path is preserved
  (those columns appear in ALIAS_MAP with confidence 1.0).
- "overtime" → "over_time" internal normalization from predictor.py is
  respected: the alias maps upstream aliases to "overtime" (the API layer
  name); batch_service then applies the predictor's _prepare_features().
"""

from __future__ import annotations

import json
import os
import re
from typing import Dict, List, Literal, Optional, Tuple

import pandas as pd
from pydantic import BaseModel

# ── Canonical feature list (ground truth from feature_names.json) ─────────────
_ARTIFACT_DIR = os.path.join(os.path.dirname(__file__), "..", "ml", "artifacts")
_FEATURE_NAMES_PATH = os.path.join(_ARTIFACT_DIR, "feature_names.json")

with open(_FEATURE_NAMES_PATH, "r") as _f:
    CANONICAL_FEATURES: List[str] = json.load(_f)

# Total features required — always 31 for model_v1
FEATURES_REQUIRED: int = len(CANONICAL_FEATURES)

# Thresholds
INCOMPATIBLE_THRESHOLD: int = 16        # < 16 → INCOMPATIBLE
PARTIAL_THRESHOLD: int = FEATURES_REQUIRED  # 31 → FULLY_COMPATIBLE

# Minimum confidence to accept a fuzzy/token-based match
FUZZY_CONFIDENCE_THRESHOLD: float = 0.85

# Confidence assigned to each resolution path
CONFIDENCE_EXACT_CANONICAL: float = 1.0
CONFIDENCE_NORMALIZED: float = 1.0
CONFIDENCE_ALIAS: float = 0.95
CONFIDENCE_FUZZY: float = 0.85          # only used when above threshold

# ── Alias dictionary ───────────────────────────────────────────────────────────
# Maps normalized uploaded column names → canonical internal feature name.
# The canonical names match feature_names.json exactly (snake_case).
#
# Grouping convention:
#   Each block covers one canonical feature.
#   IBM PascalCase originals are included so this also serves as the
#   normalized-IBM path (they normalize to the same key after to_normalized()).
#
# NOTE: "overtime" (API layer name) maps to "over_time" internally via
# predictor._prepare_features().  All aliases here target "overtime" so the
# existing normalization chain is preserved.
#
# NEVER add ambiguous single-word aliases (e.g. "salary" alone) without
# strong domain justification — ambiguous keys must remain in
# unrecognized_columns.

ALIAS_MAP: Dict[str, str] = {
    # ── age ────────────────────────────────────────────────────────────────────
    "age":                          "age",
    "employee_age":                 "age",
    "emp_age":                      "age",
    "worker_age":                   "age",
    "staff_age":                    "age",
    "age_years":                    "age",

    # ── business_travel ────────────────────────────────────────────────────────
    "business_travel":              "business_travel",
    "businesstravel":               "business_travel",
    "travel":                       "business_travel",
    "travel_frequency":             "business_travel",
    "travel_status":                "business_travel",
    "business_travel_frequency":    "business_travel",

    # ── daily_rate ─────────────────────────────────────────────────────────────
    "daily_rate":                   "daily_rate",
    "dailyrate":                    "daily_rate",
    "day_rate":                     "daily_rate",
    "daily_pay_rate":               "daily_rate",
    "per_day_rate":                 "daily_rate",

    # ── department ────────────────────────────────────────────────────────────
    "department":                   "department",
    "dept":                         "department",
    "division":                     "department",
    "department_name":              "department",
    "dept_name":                    "department",
    "business_unit":                "department",
    "team_department":              "department",

    # ── distance_from_home ───────────────────────────────────────────────────
    "distance_from_home":           "distance_from_home",
    "distancefromhome":             "distance_from_home",
    "commute_distance":             "distance_from_home",
    "home_distance":                "distance_from_home",
    "distance_to_work":             "distance_from_home",
    "commute_km":                   "distance_from_home",
    "distance_km":                  "distance_from_home",

    # ── education ─────────────────────────────────────────────────────────────
    "education":                    "education",
    "education_level":              "education",
    "edu_level":                    "education",
    "qualification":                "education",
    "education_degree":             "education",

    # ── education_field ──────────────────────────────────────────────────────
    "education_field":              "education_field",
    "educationfield":               "education_field",
    "field_of_education":           "education_field",
    "study_field":                  "education_field",
    "major":                        "education_field",
    "edu_field":                    "education_field",
    "educational_background":       "education_field",

    # ── environment_satisfaction ─────────────────────────────────────────────
    "environment_satisfaction":     "environment_satisfaction",
    "environmentsatisfaction":      "environment_satisfaction",
    "env_satisfaction":             "environment_satisfaction",
    "workplace_satisfaction":       "environment_satisfaction",
    "work_environment_satisfaction":"environment_satisfaction",

    # ── gender ────────────────────────────────────────────────────────────────
    "gender":                       "gender",
    "sex":                          "gender",
    "employee_gender":              "gender",

    # ── hourly_rate ──────────────────────────────────────────────────────────
    "hourly_rate":                  "hourly_rate",
    "hourlyrate":                   "hourly_rate",
    "per_hour_rate":                "hourly_rate",
    "hourly_pay":                   "hourly_rate",
    "hourly_wage":                  "hourly_rate",
    "hour_rate":                    "hourly_rate",

    # ── job_involvement ──────────────────────────────────────────────────────
    "job_involvement":              "job_involvement",
    "jobinvolvement":               "job_involvement",
    "engagement_level":             "job_involvement",
    "work_involvement":             "job_involvement",
    "job_engagement":               "job_involvement",

    # ── job_level ────────────────────────────────────────────────────────────
    "job_level":                    "job_level",
    "joblevel":                     "job_level",
    "grade":                        "job_level",
    "pay_grade":                    "job_level",
    "employee_grade":               "job_level",
    "seniority_level":              "job_level",
    "level":                        "job_level",

    # ── job_role ─────────────────────────────────────────────────────────────
    "job_role":                     "job_role",
    "jobrole":                      "job_role",
    "position":                     "job_role",
    "designation":                  "job_role",
    "title":                        "job_role",
    "job_title":                    "job_role",
    "role":                         "job_role",
    "employee_role":                "job_role",

    # ── job_satisfaction ─────────────────────────────────────────────────────
    "job_satisfaction":             "job_satisfaction",
    "jobsatisfaction":              "job_satisfaction",
    "satisfaction":                 "job_satisfaction",
    "work_satisfaction":            "job_satisfaction",
    "employee_satisfaction":        "job_satisfaction",

    # ── marital_status ───────────────────────────────────────────────────────
    "marital_status":               "marital_status",
    "maritalstatus":                "marital_status",
    "civil_status":                 "marital_status",
    "relationship_status":          "marital_status",
    "matrimonial_status":           "marital_status",

    # ── monthly_income ───────────────────────────────────────────────────────
    # NOTE: "salary" alone is intentionally EXCLUDED — too ambiguous
    # (could be annual, hourly, etc.). Only compound forms are aliased.
    "monthly_income":               "monthly_income",
    "monthlyincome":                "monthly_income",
    "monthly_salary":               "monthly_income",
    "salary_monthly":               "monthly_income",
    "monthly_pay":                  "monthly_income",
    "monthly_compensation":         "monthly_income",
    "monthly_wage":                 "monthly_income",
    "base_monthly_salary":          "monthly_income",

    # ── monthly_rate ─────────────────────────────────────────────────────────
    "monthly_rate":                 "monthly_rate",
    "monthlyrate":                  "monthly_rate",
    "monthly_pay_rate":             "monthly_rate",

    # ── num_companies_worked ─────────────────────────────────────────────────
    "num_companies_worked":         "num_companies_worked",
    "numcompaniesworked":           "num_companies_worked",
    "companies_worked":             "num_companies_worked",
    "number_of_companies":          "num_companies_worked",
    "number_of_companies_worked":   "num_companies_worked",
    "numberofcompaniesworked":      "num_companies_worked",
    "no_of_companies_worked":       "num_companies_worked",
    "num_of_companies_worked":      "num_companies_worked",
    "previous_employers":           "num_companies_worked",
    "employers_count":              "num_companies_worked",
    "companies_count":              "num_companies_worked",

    # ── over_time (NOTE: API layer calls this "overtime"; predictor renames it)
    "over_time":                    "over_time",
    "overtime":                     "over_time",
    "overtime_status":              "over_time",
    "ot":                           "over_time",
    "ot_status":                    "over_time",
    "over_time_status":             "over_time",
    "working_overtime":             "over_time",
    "ot_flag":                      "over_time",

    # ── percent_salary_hike ──────────────────────────────────────────────────
    "percent_salary_hike":          "percent_salary_hike",
    "percentsalaryhike":            "percent_salary_hike",
    "salary_hike_percent":          "percent_salary_hike",
    "salary_hike":                  "percent_salary_hike",
    "pay_hike":                     "percent_salary_hike",
    "hike_percentage":              "percent_salary_hike",
    "raise_percent":                "percent_salary_hike",

    # ── performance_rating ───────────────────────────────────────────────────
    "performance_rating":           "performance_rating",
    "performancerating":            "performance_rating",
    "perf_rating":                  "performance_rating",
    "rating":                       "performance_rating",
    "annual_rating":                "performance_rating",
    "performance_score":            "performance_rating",

    # ── relationship_satisfaction ────────────────────────────────────────────
    "relationship_satisfaction":    "relationship_satisfaction",
    "relationshipsatisfaction":     "relationship_satisfaction",
    "relationship_score":           "relationship_satisfaction",
    "manager_relationship":         "relationship_satisfaction",
    "peer_satisfaction":            "relationship_satisfaction",

    # ── stock_option_level ───────────────────────────────────────────────────
    "stock_option_level":           "stock_option_level",
    "stockoptionlevel":             "stock_option_level",
    "stock_options":                "stock_option_level",
    "equity_level":                 "stock_option_level",
    "stock_level":                  "stock_option_level",

    # ── total_working_years ──────────────────────────────────────────────────
    "total_working_years":          "total_working_years",
    "totalworkingyears":            "total_working_years",
    "total_experience":             "total_working_years",
    "work_experience_years":        "total_working_years",
    "career_years":                 "total_working_years",
    "total_years_worked":           "total_working_years",
    "experience_years":             "total_working_years",

    # ── training_times_last_year ─────────────────────────────────────────────
    "training_times_last_year":     "training_times_last_year",
    "trainingtimeslastyear":        "training_times_last_year",
    "trainings_last_year":          "training_times_last_year",
    "training_count":               "training_times_last_year",
    "training_sessions":            "training_times_last_year",
    "training_frequency":           "training_times_last_year",

    # ── work_life_balance ────────────────────────────────────────────────────
    "work_life_balance":            "work_life_balance",
    "worklifebalance":              "work_life_balance",
    "wlb":                          "work_life_balance",
    "work_balance":                 "work_life_balance",
    "life_balance":                 "work_life_balance",

    # ── years_at_company ─────────────────────────────────────────────────────
    "years_at_company":             "years_at_company",
    "yearsatcompany":               "years_at_company",
    "tenure":                       "years_at_company",
    "company_tenure":               "years_at_company",
    "years_employed":               "years_at_company",
    "employment_years":             "years_at_company",
    "years_with_company":           "years_at_company",
    "service_years":                "years_at_company",

    # ── years_in_current_role ────────────────────────────────────────────────
    "years_in_current_role":        "years_in_current_role",
    "yearsincurrentrole":           "years_in_current_role",
    "role_tenure":                  "years_in_current_role",
    "years_in_role":                "years_in_current_role",
    "current_role_years":           "years_in_current_role",

    # ── years_since_last_promotion ───────────────────────────────────────────
    "years_since_last_promotion":   "years_since_last_promotion",
    "yearssincelastpromotion":      "years_since_last_promotion",
    "last_promotion_years":         "years_since_last_promotion",
    "promotion_gap":                "years_since_last_promotion",
    "years_since_promotion":        "years_since_last_promotion",

    # ── years_with_curr_manager ──────────────────────────────────────────────
    "years_with_curr_manager":      "years_with_curr_manager",
    "yearswithcurrmanager":         "years_with_curr_manager",
    "years_with_manager":           "years_with_curr_manager",
    "manager_tenure":               "years_with_curr_manager",
    "years_under_manager":          "years_with_curr_manager",
    "manager_years":                "years_with_curr_manager",
}

# Canonical set for O(1) membership testing
_CANONICAL_SET: set = set(CANONICAL_FEATURES)

# Build a normalized → canonical lookup from the canonical list itself
# (so exact snake_case names always resolve even without an alias entry)
_CANONICAL_NORMALIZED: Dict[str, str] = {feat: feat for feat in CANONICAL_FEATURES}


# ── Normalization helpers ──────────────────────────────────────────────────────

def _normalize(name: str) -> str:
    """
    Normalize a column name to a comparable key:
      1. Strip surrounding whitespace
      2. Lowercase
      3. Replace spaces and hyphens with underscores
      4. Collapse consecutive underscores
    """
    name = name.strip().lower()
    name = re.sub(r"[\s\-]+", "_", name)
    name = re.sub(r"_+", "_", name)
    return name


def _camel_to_snake(name: str) -> str:
    """Convert CamelCase / PascalCase to snake_case."""
    s = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s).lower()


# ── Resolution logic ──────────────────────────────────────────────────────────

def _resolve_column(raw_col: str) -> Tuple[Optional[str], float, str]:
    """
    Attempt to resolve one uploaded column name to a canonical feature name.

    Returns
    -------
    (canonical_name, confidence, resolution_method)
      canonical_name  — None if unresolvable
      confidence      — float in [0, 1]
      resolution_method — "exact_canonical" | "normalized" | "alias" |
                          "fuzzy" | "unresolved"
    """
    # Priority 1: exact canonical match (uploaded col is already in canonical set)
    if raw_col in _CANONICAL_SET:
        return raw_col, CONFIDENCE_EXACT_CANONICAL, "exact_canonical"

    # Priority 2: normalized match against canonical set
    normalized = _normalize(raw_col)
    if normalized in _CANONICAL_NORMALIZED:
        return _CANONICAL_NORMALIZED[normalized], CONFIDENCE_NORMALIZED, "normalized"

    # Also try CamelCase → snake decomposition, then normalize
    snake = _normalize(_camel_to_snake(raw_col))
    if snake in _CANONICAL_NORMALIZED:
        return _CANONICAL_NORMALIZED[snake], CONFIDENCE_NORMALIZED, "normalized"

    # Priority 3: alias dictionary (explicit, curated)
    if normalized in ALIAS_MAP:
        return ALIAS_MAP[normalized], CONFIDENCE_ALIAS, "alias"
    if snake in ALIAS_MAP:
        return ALIAS_MAP[snake], CONFIDENCE_ALIAS, "alias"

    # Priority 4: fuzzy token overlap (only when confidence ≥ threshold)
    canonical_match, fuzzy_conf = _fuzzy_match(normalized)
    if canonical_match is not None and fuzzy_conf >= FUZZY_CONFIDENCE_THRESHOLD:
        return canonical_match, fuzzy_conf, "fuzzy"

    return None, 0.0, "unresolved"


def _fuzzy_match(normalized_col: str) -> Tuple[Optional[str], float]:
    """
    Token-overlap heuristic: split the normalized column name into tokens
    and compute Jaccard similarity against each canonical feature's tokens.

    Only used as a last resort, and only when confidence ≥ FUZZY_CONFIDENCE_THRESHOLD.
    Single-token columns are NOT matched via this path to avoid ambiguous mappings.
    """
    tokens_query = set(normalized_col.split("_"))

    # Refuse fuzzy matching for single-token inputs (too ambiguous)
    if len(tokens_query) < 2:
        return None, 0.0

    best_canonical: Optional[str] = None
    best_score: float = 0.0

    for canonical in CANONICAL_FEATURES:
        tokens_canonical = set(canonical.split("_"))
        intersection = tokens_query & tokens_canonical
        union = tokens_query | tokens_canonical
        if not union:
            continue
        jaccard = len(intersection) / len(union)
        if jaccard > best_score:
            best_score = jaccard
            best_canonical = canonical

    return best_canonical, best_score


# ── Employee-ID column detection ──────────────────────────────────────────────

_EMP_ID_ALIASES: set = {
    "employeenumber", "employee_number", "emp_number", "emp_no",
    "employee_id", "emp_id", "staff_id", "worker_id", "id",
    "personnel_id", "person_id",
}


def _detect_employee_id_column(columns: List[str]) -> Optional[str]:
    """Return the first column that looks like an employee identifier, or None."""
    for col in columns:
        if _normalize(_camel_to_snake(col)) in _EMP_ID_ALIASES:
            return col
        if _normalize(col) in _EMP_ID_ALIASES:
            return col
    return None


# ── Pydantic output model ──────────────────────────────────────────────────────

class CompatibilityReport(BaseModel):
    """
    Structured result of analyzing an uploaded CSV against the model's
    canonical feature schema.
    """
    status: Literal["FULLY_COMPATIBLE", "PARTIALLY_COMPATIBLE", "INCOMPATIBLE"]

    # Feature counts
    features_found: int
    features_required: int
    data_completeness_percentage: float

    # Column mapping details
    mapped_columns: Dict[str, str]              # upload_col → canonical_name
    mapping_confidence: Dict[str, float]        # canonical_name → confidence
    mapping_method: Dict[str, str]              # canonical_name → method string
    missing_features: List[str]                 # canonical names not found
    unrecognized_columns: List[str]             # upload cols that could not be resolved

    # Employee-ID column (not a model feature; used to identify rows)
    employee_id_column: Optional[str]

    # Prediction safety flags
    is_estimated: bool                          # True for PARTIALLY_COMPATIBLE
    estimated_prediction_safe: bool            # True when pipeline imputation covers gaps


# ── Main entry point ──────────────────────────────────────────────────────────

def analyze_csv_compatibility(df: pd.DataFrame) -> CompatibilityReport:
    """
    Analyze a DataFrame's columns against the canonical feature schema.

    Parameters
    ----------
    df : pd.DataFrame
        The parsed CSV to analyze.

    Returns
    -------
    CompatibilityReport
        Fully populated report; does NOT mutate the DataFrame.
    """
    upload_columns: List[str] = list(df.columns)

    # Detect employee-ID column (excluded from feature matching)
    emp_id_col: Optional[str] = _detect_employee_id_column(upload_columns)

    mapped_columns: Dict[str, str] = {}          # upload_col → canonical
    mapping_confidence: Dict[str, float] = {}    # canonical → confidence
    mapping_method: Dict[str, str] = {}          # canonical → method
    unrecognized: List[str] = []
    resolved_canonicals: set = set()

    for col in upload_columns:
        # Skip the employee-ID column — it is not a model feature
        if col == emp_id_col:
            continue

        canonical, confidence, method = _resolve_column(col)

        if canonical is None:
            unrecognized.append(col)
            continue

        # Collision guard: if two upload columns resolve to the same canonical
        # feature, keep the one with higher confidence (first-come wins on ties)
        if canonical in resolved_canonicals:
            # Find the existing upload col that mapped to this canonical
            existing_upload_col = next(
                (k for k, v in mapped_columns.items() if v == canonical), None
            )
            if existing_upload_col is not None:
                existing_conf = mapping_confidence.get(canonical, 0.0)
                if confidence > existing_conf:
                    # Replace with higher-confidence mapping
                    del mapped_columns[existing_upload_col]
                    unrecognized.append(existing_upload_col)
                    mapped_columns[col] = canonical
                    mapping_confidence[canonical] = confidence
                    mapping_method[canonical] = method
                else:
                    unrecognized.append(col)
            continue

        mapped_columns[col] = canonical
        mapping_confidence[canonical] = confidence
        mapping_method[canonical] = method
        resolved_canonicals.add(canonical)

    # Determine missing features (canonical features with no resolved upload column)
    missing_features: List[str] = [
        feat for feat in CANONICAL_FEATURES if feat not in resolved_canonicals
    ]

    features_found: int = len(resolved_canonicals)
    completeness_pct: float = round(
        (features_found / FEATURES_REQUIRED) * 100, 1
    )

    # Determine compatibility status
    if features_found == FEATURES_REQUIRED:
        status: Literal["FULLY_COMPATIBLE", "PARTIALLY_COMPATIBLE", "INCOMPATIBLE"] = (
            "FULLY_COMPATIBLE"
        )
        is_estimated = False
        estimated_safe = True
    elif features_found >= INCOMPATIBLE_THRESHOLD:
        status = "PARTIALLY_COMPATIBLE"
        is_estimated = True
        # Safe only when the pipeline's SimpleImputer covers all feature types
        # (it always does for this model — median for numerical, most_frequent for categorical)
        estimated_safe = True
    else:
        status = "INCOMPATIBLE"
        is_estimated = False
        estimated_safe = False

    return CompatibilityReport(
        status=status,
        features_found=features_found,
        features_required=FEATURES_REQUIRED,
        data_completeness_percentage=completeness_pct,
        mapped_columns=mapped_columns,
        mapping_confidence=mapping_confidence,
        mapping_method=mapping_method,
        missing_features=missing_features,
        unrecognized_columns=unrecognized,
        employee_id_column=emp_id_col,
        is_estimated=is_estimated,
        estimated_prediction_safe=estimated_safe,
    )
