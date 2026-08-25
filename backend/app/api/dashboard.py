from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from app.database.session import get_db
from app.models.prediction import Prediction
from app.models.prediction_explanation import PredictionExplanation
from app.models.employee import Employee
from app.auth.dependencies import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.get("/summary")
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    emp_count_result = await db.execute(select(func.count(Employee.id)))
    total_employees = emp_count_result.scalar_one() or 0

    risk_result = await db.execute(
        select(Prediction.risk_level, func.count(Prediction.id)).group_by(Prediction.risk_level)
    )
    risk_dist = {row[0]: row[1] for row in risk_result.all()}

    avg_result = await db.execute(select(func.avg(Prediction.attrition_probability)))
    avg_prob = avg_result.scalar_one() or 0.0

    total_pred_result = await db.execute(select(func.count(Prediction.id)))
    total_predictions = total_pred_result.scalar_one() or 0

    return {
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

    Removes predictions, prediction explanations, and prediction employee records
    so that dashboard and analytics naturally return to genuine empty-state metrics.
    User accounts, organizations, ML models, and auth state are NEVER touched.
    """
    # 1. Count existing predictions for the response summary
    count_result = await db.execute(select(func.count(Prediction.id)))
    pred_count = count_result.scalar_one() or 0

    # 2. Delete child explanations first to respect foreign-key constraints
    await db.execute(delete(PredictionExplanation))

    # 3. Delete predictions
    await db.execute(delete(Prediction))

    # 4. Delete prediction-generated employee master records
    await db.execute(delete(Employee))

    # 5. Commit transaction
    await db.commit()

    return {
        "success": True,
        "deleted_predictions": pred_count,
    }
