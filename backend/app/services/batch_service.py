"""
Batch Prediction Service
========================
Orchestrates CSV upload → compatibility analysis → prediction → persistence.

Key behaviours
--------------
- Calls ``analyze_csv_compatibility()`` first; if INCOMPATIBLE returns early.
- FULLY_COMPATIBLE:   uses existing ``map_csv_row_to_features()`` path (IBM format).
- PARTIALLY_COMPATIBLE: uses ``map_row_with_compatibility()``; NaN values are
                        handled by the pipeline's built-in SimpleImputer; results
                        are marked ``is_estimated=True``.
- Employee-ID column is detected by the compatibility report; falls back to
  'EmployeeNumber' for the canonical IBM format.
- Duplicate employee-number detection still works for all resolved ID columns.
- Row-level categorical validation is preserved.
- The existing IBM HR CSV path is never broken.
"""

import io
import math
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from app.ml.predictor import get_predictor
from app.ml.explainer import get_explainer
from app.models.employee import Employee
from app.models.prediction import Prediction
from app.models.prediction_explanation import PredictionExplanation
from app.schemas.prediction import (
    BatchPredictionResponse,
    BatchPredictionRecord,
    BatchValidationError,
    CompatibilityReport as CompatibilityReportSchema,
)
from app.utils.config import settings
from app.utils.dataset_compatibility import analyze_csv_compatibility
from app.utils.feature_mapping import map_csv_row_to_features, map_row_with_compatibility
import uuid

# ── Categorical validation values (unchanged from original) ───────────────────
VALID_CATEGORIES = {
    "Gender": [
        "Male", "Female",
        # also accept lowercase / normalized forms
        "male", "female",
    ],
    "MaritalStatus": ["Single", "Married", "Divorced", "single", "married", "divorced"],
    "BusinessTravel": [
        "Non-Travel", "Travel_Rarely", "Travel_Frequently",
        "non-travel", "travel_rarely", "travel_frequently",
    ],
    "OverTime": ["Yes", "No", "yes", "no"],
    "Department": [
        "Sales", "Research & Development", "Human Resources",
        "sales", "research & development", "human resources",
    ],
    "EducationField": [
        "Life Sciences", "Medical", "Marketing", "Technical Degree",
        "Human Resources", "Other",
    ],
    "JobRole": [
        "Sales Executive", "Research Scientist", "Laboratory Technician",
        "Manufacturing Director", "Healthcare Representative", "Manager",
        "Sales Representative", "Research Director", "Human Resources",
    ],
}

# Canonical internal name → validation category key mapping
# Used when validating rows from non-IBM CSVs
_CANONICAL_TO_VALID_KEY = {
    "gender":          "Gender",
    "marital_status":  "MaritalStatus",
    "business_travel": "BusinessTravel",
    "over_time":       "OverTime",
    "overtime":        "OverTime",   # API layer name
    "department":      "Department",
    "education_field": "EducationField",
    "job_role":        "JobRole",
}


def _safe_int(val) -> int | None:
    """Convert a value to int, returning None on failure."""
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def _is_nan(val) -> bool:
    try:
        return val is None or (isinstance(val, float) and math.isnan(val))
    except TypeError:
        return False


class BatchService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.predictor = get_predictor()
        self.explainer = get_explainer()

    async def process_batch(self, csv_bytes: bytes) -> BatchPredictionResponse:
        df = pd.read_csv(io.BytesIO(csv_bytes))

        # ── 1. Compatibility analysis ─────────────────────────────────────────
        report = analyze_csv_compatibility(df)

        # Convert the utility-layer report to the schema-layer report
        compat_schema = CompatibilityReportSchema(**report.model_dump())

        # ── 2. INCOMPATIBLE — return early, no predictions ────────────────────
        if report.status == "INCOMPATIBLE":
            return BatchPredictionResponse(
                total_rows=len(df),
                successful=0,
                failed=len(df),
                validation_errors=[
                    BatchValidationError(
                        row=0,
                        employee_number=None,
                        errors=[
                            f"Dataset is INCOMPATIBLE: only {report.features_found} of "
                            f"{report.features_required} required model features could be "
                            f"identified (minimum required: 16). "
                            f"Unrecognized columns: {report.unrecognized_columns}. "
                            f"Missing features: {report.missing_features}."
                        ],
                    )
                ],
                results=[],
                compatibility_report=compat_schema,
            )

        # ── 3. Determine row-level feature-building strategy ──────────────────
        is_ibm_format = report.status == "FULLY_COMPATIBLE" and _is_classic_ibm_format(df)
        is_estimated = report.status == "PARTIALLY_COMPATIBLE"

        # ── 4. Determine employee-ID column ───────────────────────────────────
        emp_id_col = report.employee_id_column or "EmployeeNumber"
        if emp_id_col not in df.columns:
            # Fallback: try common variations
            for candidate in ("EmployeeNumber", "employee_number", "emp_id", "id"):
                if candidate in df.columns:
                    emp_id_col = candidate
                    break
            else:
                emp_id_col = df.columns[0]  # last resort

        # ── 5. Duplicate employee-number check ────────────────────────────────
        if emp_id_col in df.columns:
            duplicates = df[df.duplicated(subset=[emp_id_col], keep=False)]
            if not duplicates.empty:
                dup_nums = duplicates[emp_id_col].unique().tolist()
                return BatchPredictionResponse(
                    total_rows=len(df),
                    successful=0,
                    failed=len(df),
                    validation_errors=[
                        BatchValidationError(
                            row=0,
                            employee_number=None,
                            errors=[f"Duplicate employee IDs found: {dup_nums}"],
                        )
                    ],
                    results=[],
                    compatibility_report=compat_schema,
                )

        # ── 6. Build reverse mapping: canonical_name → upload_col ─────────────
        # Used to locate values for categorical validation on non-IBM formats
        canonical_to_upload: dict = {v: k for k, v in report.mapped_columns.items()}

        # ── 7. Row-level processing ───────────────────────────────────────────
        validation_errors = []
        results = []

        for idx, row in df.iterrows():
            row_errors = []
            emp_num = None

            # Extract employee number
            if emp_id_col in row:
                emp_num = _safe_int(row[emp_id_col])

            # If no employee ID or non-integer, fallback to row number
            if emp_num is None:
                emp_num = int(idx) + 1

            # ── Categorical validation (Strict for FULLY_COMPATIBLE mode) ───────
            if not is_estimated:
                for cat_key, valid_vals in VALID_CATEGORIES.items():
                    cell_val = None
                    if cat_key in row:
                        # IBM PascalCase column present
                        cell_val = str(row[cat_key])
                    else:
                        # Look up by canonical name via reverse mapping
                        canonical = cat_key.lower().replace("-", "_")
                        upload_col = canonical_to_upload.get(canonical)
                        if upload_col and upload_col in row:
                            cell_val = str(row[upload_col])

                    if cell_val is not None and cell_val not in valid_vals and cell_val != "nan":
                        row_errors.append(
                            f"{cat_key}: '{cell_val}' is not a recognized value. "
                            f"Expected one of: {[v for v in valid_vals if v[0].isupper()]}"
                        )

                if row_errors:
                    validation_errors.append(
                        BatchValidationError(
                            row=int(idx) + 2,
                            employee_number=emp_num,
                            errors=row_errors,
                        )
                    )
                    continue

            # ── Feature extraction ─────────────────────────────────────────────
            try:
                if is_ibm_format:
                    features = map_csv_row_to_features(row)
                else:
                    features = map_row_with_compatibility(row, report.mapped_columns)

                probability = self.predictor.predict_proba(features)
                risk_level = settings.get_risk_level(probability)
                explanation_data = self.explainer.explain(features, probability)

                employee = Employee(
                    id=str(uuid.uuid4()),
                    employee_number=emp_num,
                    feature_snapshot=features,
                )
                self.db.add(employee)
                await self.db.flush()

                pred_id = str(uuid.uuid4())
                prediction = Prediction(
                    id=pred_id,
                    employee_id=employee.id,
                    employee_number=emp_num,
                    attrition_probability=probability,
                    risk_level=risk_level,
                    model_version=settings.MODEL_VERSION,
                    input_features=features,
                )
                self.db.add(prediction)
                await self.db.flush()

                exp_record = PredictionExplanation(
                    id=str(uuid.uuid4()),
                    prediction_id=pred_id,
                    top_risk_factors=[f.model_dump() for f in explanation_data.top_risk_factors],
                    top_protective_factors=[f.model_dump() for f in explanation_data.top_protective_factors],
                    base_value=explanation_data.base_value,
                )
                self.db.add(exp_record)

                results.append(
                    BatchPredictionRecord(
                        employee_number=emp_num,
                        attrition_probability=round(probability, 4),
                        risk_level=risk_level,
                        prediction_id=pred_id,
                        is_estimated=is_estimated,
                    )
                )

            except Exception as e:
                validation_errors.append(
                    BatchValidationError(
                        row=int(idx) + 2,
                        employee_number=emp_num,
                        errors=[str(e)],
                    )
                )

        await self.db.commit()
        return BatchPredictionResponse(
            total_rows=len(df),
            successful=len(results),
            failed=len(validation_errors),
            validation_errors=validation_errors,
            results=results,
            compatibility_report=compat_schema,
        )


def _is_classic_ibm_format(df: pd.DataFrame) -> bool:
    """
    Return True only when ALL 31 IBM PascalCase column names are present
    in the DataFrame.  Used to decide whether to use the original fast
    ``map_csv_row_to_features()`` path.
    """
    from app.utils.feature_mapping import COLUMN_MAP
    return all(col in df.columns for col in COLUMN_MAP)
