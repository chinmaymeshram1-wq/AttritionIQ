import io
import math
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database.session import get_db
from app.models.employee import Employee
from app.models.prediction import Prediction
from app.models.prediction_explanation import PredictionExplanation
from app.models.dataset import Dataset
from app.auth.dependencies import get_current_active_user
from app.models.user import User
from app.utils.dataset_compatibility import analyze_csv_compatibility
from app.utils.sanitizer import sanitize_for_json

router = APIRouter()

_MAX_CSV_BYTES = 10 * 1024 * 1024  # 10 MB


async def _resolve_dataset_id(db: AsyncSession, dataset_id: Optional[str], org_id: Optional[str]) -> Optional[str]:
    if dataset_id:
        return dataset_id
    stmt = select(Dataset.id).where(Dataset.status == "READY").order_by(Dataset.dataset_number.asc()).limit(1)
    if org_id:
        stmt = stmt.where(Dataset.organization_id == org_id)
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


@router.get("")
async def list_employees(
    page: int = 1,
    page_size: int = 20,
    dataset_id: Optional[str] = None,
    include_risk: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    active_dataset_id = await _resolve_dataset_id(db, dataset_id, current_user.organization_id)
    if not active_dataset_id:
        return {"employees": [], "page": page, "total": 0}

    # Count total for pagination
    count_stmt = select(Employee.id).where(Employee.dataset_id == active_dataset_id)
    count_result = await db.execute(count_stmt)
    total = len(count_result.scalars().all())

    offset = (page - 1) * page_size
    stmt = (
        select(Employee)
        .where(Employee.dataset_id == active_dataset_id)
        .order_by(Employee.employee_number)
        .limit(page_size)
        .offset(offset)
    )
    result = await db.execute(stmt)
    employees = result.scalars().all()

    # Optionally fetch latest prediction per employee
    risk_map: dict = {}
    if include_risk and employees:
        emp_numbers = [e.employee_number for e in employees]
        # Fetch latest prediction per employee_number in this dataset
        pred_stmt = (
            select(Prediction)
            .where(
                Prediction.dataset_id == active_dataset_id,
                Prediction.is_standalone == False,
                Prediction.employee_number.in_(emp_numbers),
            )
            .order_by(desc(Prediction.created_at))
        )
        pred_result = await db.execute(pred_stmt)
        all_preds = pred_result.scalars().all()
        # Keep only the latest per employee_number
        for pred in all_preds:
            if pred.employee_number not in risk_map:
                risk_map[pred.employee_number] = {
                    "risk_level": pred.risk_level,
                    "attrition_probability": pred.attrition_probability,
                }

    return sanitize_for_json({
        "employees": [
            {
                "id": e.id,
                "employee_number": e.employee_number,
                "dataset_id": e.dataset_id,
                "feature_snapshot": e.feature_snapshot if include_risk else None,
                "risk_level": risk_map.get(e.employee_number, {}).get("risk_level") if include_risk else None,
                "attrition_probability": risk_map.get(e.employee_number, {}).get("attrition_probability") if include_risk else None,
                "created_at": str(e.created_at),
            }
            for e in employees
        ],
        "page": page,
        "dataset_id": active_dataset_id,
    })


@router.get("/{employee_number}")
async def get_employee(
    employee_number: int,
    dataset_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    active_dataset_id = await _resolve_dataset_id(db, dataset_id, current_user.organization_id)

    stmt = select(Employee).where(Employee.employee_number == employee_number)
    if active_dataset_id:
        stmt = stmt.where(Employee.dataset_id == active_dataset_id)

    result = await db.execute(stmt)
    employee = result.scalars().first()

    if not employee:
        raise HTTPException(status_code=404, detail=f"Employee {employee_number} not found in the selected dataset")

    # Latest prediction for this employee in this dataset
    pred_stmt = select(Prediction).where(
        Prediction.employee_number == employee_number,
        Prediction.is_standalone == False,
    )
    if active_dataset_id:
        pred_stmt = pred_stmt.where(Prediction.dataset_id == active_dataset_id)
    pred_stmt = pred_stmt.order_by(desc(Prediction.created_at)).limit(1)

    pred_result = await db.execute(pred_stmt)
    prediction = pred_result.scalars().first()

    explanation = None
    if prediction:
        exp_result = await db.execute(
            select(PredictionExplanation).where(
                PredictionExplanation.prediction_id == prediction.id
            )
        )
        explanation = exp_result.scalars().first()

    return sanitize_for_json({
        "employee": {
            "id": employee.id,
            "employee_number": employee.employee_number,
            "dataset_id": employee.dataset_id,
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
    })


@router.post("/search/analyze")
async def analyze_employee_dataset(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    content = await file.read()
    if len(content) > _MAX_CSV_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum 10 MB.")

    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse CSV: {e}")

    try:
        report = analyze_csv_compatibility(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compatibility analysis failed: {e}")

    return sanitize_for_json({
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
    })


@router.post("/search")
async def search_employee_in_dataset(
    file: UploadFile = File(...),
    employee_id: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    content = await file.read()
    if len(content) > _MAX_CSV_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum 10 MB.")

    employee_id = employee_id.strip()
    if not employee_id:
        raise HTTPException(status_code=400, detail="employee_id must not be empty.")

    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse CSV: {e}")

    try:
        report = analyze_csv_compatibility(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compatibility analysis failed: {e}")

    emp_id_col = report.employee_id_column

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

    search_norm = str(employee_id).strip()
    matched_row = None

    for _, row in df.iterrows():
        cell_val = row[emp_id_col]
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

    stored_prediction = None
    explanation_data = None

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
        prediction = pred_result.scalars().first()

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
            exp = exp_result.scalars().first()
            if exp:
                explanation_data = {
                    "top_risk_factors": exp.top_risk_factors,
                    "top_protective_factors": exp.top_protective_factors,
                    "base_value": exp.base_value,
                }

    return sanitize_for_json({
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
    })
