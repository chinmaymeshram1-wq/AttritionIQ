from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from app.database.session import get_db
from app.models.prediction import Prediction
from app.models.prediction_explanation import PredictionExplanation
from app.models.employee import Employee
from app.models.dataset import Dataset
from app.auth.dependencies import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.get("/summary")
async def dashboard_summary(
    dataset_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get dashboard summary statistics isolated to the specified dataset_id (or latest active dataset).
    Excludes standalone predictions (Individual Prediction / What-If simulations).
    """
    # If dataset_id not specified, fallback to latest READY dataset
    active_dataset_id = dataset_id
    if not active_dataset_id:
        ds_stmt = select(Dataset.id).where(Dataset.status == "READY").order_by(Dataset.dataset_number.asc()).limit(1)
        if current_user.organization_id:
            ds_stmt = ds_stmt.where(Dataset.organization_id == current_user.organization_id)
        ds_res = await db.execute(ds_stmt)
        active_dataset_id = ds_res.scalar_one_or_none()

    if not active_dataset_id:
        return {
            "total_employees_analyzed": 0,
            "high_risk_count": 0,
            "medium_risk_count": 0,
            "low_risk_count": 0,
            "average_attrition_probability": 0.0,
            "total_predictions": 0,
        }

    # Employee count for this dataset
    emp_stmt = select(func.count(Employee.id)).where(Employee.dataset_id == active_dataset_id)
    emp_count_result = await db.execute(emp_stmt)
    total_employees = emp_count_result.scalar_one() or 0

    # Risk distribution for dataset (excluding standalone predictions)
    risk_stmt = (
        select(Prediction.risk_level, func.count(Prediction.id))
        .where(Prediction.dataset_id == active_dataset_id, Prediction.is_standalone == False)
        .group_by(Prediction.risk_level)
    )
    risk_result = await db.execute(risk_stmt)
    risk_dist = {row[0]: row[1] for row in risk_result.all()}

    # Average attrition probability for dataset
    avg_stmt = select(func.avg(Prediction.attrition_probability)).where(
        Prediction.dataset_id == active_dataset_id, Prediction.is_standalone == False
    )
    avg_result = await db.execute(avg_stmt)
    avg_prob = avg_result.scalar_one() or 0.0

    total_predictions = sum(risk_dist.values())

    return {
        "dataset_id": active_dataset_id,
        "total_employees_analyzed": total_employees,
        "high_risk_count": risk_dist.get("HIGH", 0),
        "medium_risk_count": risk_dist.get("MEDIUM", 0),
        "low_risk_count": risk_dist.get("LOW", 0),
        "average_attrition_probability": round(float(avg_prob), 4),
        "total_predictions": total_predictions,
    }


@router.post("/reset-demo-data")
async def reset_demo_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Safely reset prediction demo data.
    """
    count_result = await db.execute(select(func.count(Prediction.id)))
    pred_count = count_result.scalar_one() or 0

    await db.execute(delete(PredictionExplanation))
    await db.execute(delete(Prediction))
    await db.execute(delete(Employee))
    await db.execute(delete(Dataset))
    await db.commit()

    return {
        "success": True,
        "deleted_predictions": pred_count,
    }
