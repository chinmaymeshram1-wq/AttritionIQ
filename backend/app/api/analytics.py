from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database.session import get_db
from app.models.prediction import Prediction
from app.auth.dependencies import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.get("/overview")
async def analytics_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    risk_result = await db.execute(
        select(Prediction.risk_level, func.count(Prediction.id)).group_by(Prediction.risk_level)
    )
    risk_dist = {row[0]: row[1] for row in risk_result.all()}

    # Overtime risk — uses JSON field extraction (SQLite compatible)
    ot_result = await db.execute(
        select(
            func.json_extract(Prediction.input_features, "$.overtime").label("ot"),
            func.avg(Prediction.attrition_probability).label("avg_prob"),
        ).group_by("ot")
    )
    overtime_risk = {r[0]: round(float(r[1] or 0), 4) for r in ot_result.all() if r[0]}

    return {
        "risk_distribution": risk_dist,
        "overtime_risk": overtime_risk,
    }


@router.get("/department")
async def analytics_department(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(
            func.json_extract(Prediction.input_features, "$.department").label("dept"),
            Prediction.risk_level,
            func.count(Prediction.id).label("count"),
            func.avg(Prediction.attrition_probability).label("avg_prob"),
        ).group_by("dept", Prediction.risk_level)
    )
    rows = result.all()
    agg: dict = {}
    for dept, risk, count, avg_prob in rows:
        if not dept:
            continue
        if dept not in agg:
            agg[dept] = {"department": dept, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "avg_probability": 0.0, "total": 0}
        agg[dept][risk] = count
        agg[dept]["total"] += count
        agg[dept]["avg_probability"] = round(float(avg_prob or 0), 4)
    return {"departments": list(agg.values())}


@router.get("/job-role")
async def analytics_job_role(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(
            func.json_extract(Prediction.input_features, "$.job_role").label("role"),
            Prediction.risk_level,
            func.count(Prediction.id).label("count"),
            func.avg(Prediction.attrition_probability).label("avg_prob"),
        ).group_by("role", Prediction.risk_level)
    )
    rows = result.all()
    agg: dict = {}
    for role, risk, count, avg_prob in rows:
        if not role:
            continue
        if role not in agg:
            agg[role] = {"job_role": role, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "avg_probability": 0.0, "total": 0}
        agg[role][risk] = count
        agg[role]["total"] += count
        agg[role]["avg_probability"] = round(float(avg_prob or 0), 4)
    return {"job_roles": list(agg.values())}
