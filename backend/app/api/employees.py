import io
import math

import pandas as pd
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database.session import get_db
from app.models.employee import Employee
from app.models.prediction import Prediction
from app.models.prediction_explanation import PredictionExplanation
from app.auth.dependencies import get_current_active_user
from app.models.user import User
from app.utils.dataset_compatibility import analyze_csv_compatibility

router = APIRouter()

# ── Maximum CSV size for employee-search operations (same limit as batch) ──────
_MAX_CSV_BYTES = 10 * 1024 * 1024  # 10 MB


# ─────────────────────────────────────────────────────────────────────────────
# Existing endpoints — UNCHANGED
# ─────────────────────────────────────────────────────────────────────────────

@router.get("")
async def list_employees(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    offset = (page - 1) * page_size
    result = await db.execute(
        select(Employee).order_by(Employee.employee_number).limit(page_size).offset(offset)
    )
    employees = result.scalars().all()
    return {
        "employees": [
            {
                "id": e.id,
                "employee_number": e.employee_number,
                "created_at": str(e.created_at),
            }
            for e in employees
        ],
        "page": page,
    }


@router.get("/{employee_number}")
async def get_employee(
    employee_number: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(Employee).where(Employee.employee_number == employee_number)
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail=f"Employee {employee_number} not found")

    # Latest prediction
    pred_result = await db.execute(
        select(Prediction)
        .where(Prediction.employee_number == employee_number)
        .order_by(desc(Prediction.created_at))
        .limit(1)
    )
    prediction = pred_result.scalar_one_or_none()

    explanation = None
    if prediction:
        exp_result = await db.execute(
            select(PredictionExplanation).where(
                PredictionExplanation.prediction_id == prediction.id
            )
        )
        explanation = exp_result.scalar_one_or_none()

    return {
        "employee": {
            "id": employee.id,
            "employee_number": employee.employee_number,
            "feature_snapshot": employee.feature_snapshot,
            "created_at": str(employee.created_at),
        },
        "latest_prediction": {
            "id": prediction.id,
            "attrition_probability": prediction.attrition_probability,
            "risk_level": prediction.risk_level,
            "model_version": prediction.model_version,
            "created_at": str(prediction.created_at),
        } if prediction else None,
        "explanation": {
            "top_risk_factors": explanation.top_risk_factors,
            "top_protective_factors": explanation.top_protective_factors,
            "base_value": explanation.base_value,
        } if explanation else None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# NEW — Employee Search: CSV dataset analysis (pre-flight, no employee ID yet)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/search/analyze")
async def analyze_employee_dataset(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
):
    """
    Pre-flight analysis of an uploaded HR CSV for Employee Search.

    Reads the CSV, detects the employee-ID column, and returns dataset
    metadata plus a compact compatibility report.  No employee search is
    performed; no data is persisted.

    Returns
    -------
    {
        row_count: int,
        column_count: int,
        employee_id_column: str | null,
        columns: list[str],          # all column names (for display only)
        compatibility: {
            status, features_found, features_required,
            data_completeness_percentage
        }
    }
    """
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    content = await file.read()
    if len(content) > _MAX_CSV_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum 10 MB.")

    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse CSV: {e}")

    # Reuse the existing compatibility engine — it also detects the ID column
    try:
        report = analyze_csv_compatibility(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compatibility analysis failed: {e}")

    return {
        "row_count": len(df),
        "column_count": len(df.columns),
        "employee_id_column": report.employee_id_column,
        "columns": list(df.columns),
        "compatibility": {
            "status": report.status,
            "features_found": report.features_found,
            "features_required": report.features_required,
            "data_completeness_percentage": report.data_completeness_percentage,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# NEW — Employee Search: search for a specific employee in the uploaded CSV
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/search")
async def search_employee_in_dataset(
    file: UploadFile = File(...),
    employee_id: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Search for a specific employee in an uploaded HR CSV.

    The CSV is read into memory only — it is NOT persisted.  The employee-ID
    column is auto-detected via the existing compatibility engine.  Matching
    is done via case-sensitive string comparison after whitespace trimming so
    that values like '1001', 1001, and ' 1001 ' all match, but '00123' and
    '123' are treated as distinct string identifiers.

    After finding the row in the CSV, the endpoint separately queries the
    application database for any stored prediction for that employee (matched
    by integer employee number if the ID is numeric).

    Returns
    -------
    {
        employee_row: dict,           # only the matched CSV row — not the full dataset
        employee_id_column: str,
        dataset_info: { row_count: int },
        compatibility: { status, features_found, features_required,
                         data_completeness_percentage },
        stored_prediction: { ... } | null,
        explanation: { ... } | null
    }

    Raises 404 when the employee_id is not found in the dataset.
    Raises 422 when no employee-ID column can be detected.
    """
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    content = await file.read()
    if len(content) > _MAX_CSV_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum 10 MB.")

    employee_id = employee_id.strip()
    if not employee_id:
        raise HTTPException(status_code=400, detail="employee_id must not be empty.")

    # ── Parse CSV ──────────────────────────────────────────────────────────────
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse CSV: {e}")

    # ── Compatibility / ID-column detection ───────────────────────────────────
    try:
        report = analyze_csv_compatibility(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compatibility analysis failed: {e}")

    emp_id_col = report.employee_id_column

    # Fallback: try common column names in order if the engine didn't detect one
    if emp_id_col is None:
        _FALLBACKS = [
            "EmployeeNumber", "Employee_Number", "employee_number",
            "EmployeeID", "Employee_ID", "employee_id",
            "EmpID", "Emp_ID", "emp_id",
            "EmpNo", "emp_no", "EmployeeNo", "employee_no",
        ]
        for candidate in _FALLBACKS:
            if candidate in df.columns:
                emp_id_col = candidate
                break

    if emp_id_col is None or emp_id_col not in df.columns:
        raise HTTPException(
            status_code=422,
            detail=(
                "No employee identifier column could be detected in this CSV. "
                "Ensure the file contains a column such as EmployeeNumber, "
                "Employee_ID, EmpID, or similar."
            ),
        )

    # ── String-normalised search (preserve leading zeros, no int coercion) ────
    search_norm = str(employee_id).strip()
    matched_row = None

    for _, row in df.iterrows():
        cell_val = row[emp_id_col]
        # Handle NaN values gracefully
        try:
            if cell_val is None or (isinstance(cell_val, float) and math.isnan(cell_val)):
                continue
        except (TypeError, ValueError):
            pass
        if str(cell_val).strip() == search_norm:
            matched_row = row
            break

    if matched_row is None:
        raise HTTPException(
            status_code=404,
            detail=f"Employee ID '{employee_id}' was not found in the uploaded dataset.",
        )

    # ── Serialise the matched row — replace NaN with None for JSON safety ─────
    employee_row: dict = {}
    for col in df.columns:
        val = matched_row[col]
        try:
            if hasattr(val, "item"):
                val = val.item()
            if isinstance(val, float) and math.isnan(val):
                val = None
        except (TypeError, ValueError):
            pass
        employee_row[col] = val

    # ── Optional: look up any stored prediction for this employee ─────────────
    stored_prediction = None
    explanation_data = None

    # DB lookup only makes sense when the search ID is a plain integer
    try:
        emp_num_int = int(search_norm)
    except ValueError:
        emp_num_int = None

    if emp_num_int is not None:
        pred_result = await db.execute(
            select(Prediction)
            .where(Prediction.employee_number == emp_num_int)
            .order_by(desc(Prediction.created_at))
            .limit(1)
        )
        prediction = pred_result.scalar_one_or_none()

        if prediction:
            stored_prediction = {
                "id": prediction.id,
                "attrition_probability": prediction.attrition_probability,
                "risk_level": prediction.risk_level,
                "model_version": prediction.model_version,
                "created_at": str(prediction.created_at),
            }

            exp_result = await db.execute(
                select(PredictionExplanation).where(
                    PredictionExplanation.prediction_id == prediction.id
                )
            )
            exp = exp_result.scalar_one_or_none()
            if exp:
                explanation_data = {
                    "top_risk_factors": exp.top_risk_factors,
                    "top_protective_factors": exp.top_protective_factors,
                    "base_value": exp.base_value,
                }

    return {
        "employee_row": employee_row,
        "employee_id_column": emp_id_col,
        "dataset_info": {"row_count": len(df)},
        "compatibility": {
            "status": report.status,
            "features_found": report.features_found,
            "features_required": report.features_required,
            "data_completeness_percentage": report.data_completeness_percentage,
        },
        "stored_prediction": stored_prediction,
        "explanation": explanation_data,
    }
