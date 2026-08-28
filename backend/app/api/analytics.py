from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database.session import get_db
from app.models.prediction import Prediction
from app.models.dataset import Dataset
from app.auth.dependencies import get_current_active_user
from app.models.user import User

router = APIRouter()


async def _resolve_dataset_id(db: AsyncSession, dataset_id: Optional[str], org_id: Optional[str]) -> Optional[str]:
    if dataset_id:
        return dataset_id
    stmt = select(Dataset.id).where(Dataset.status == "READY").order_by(Dataset.dataset_number.asc()).limit(1)
    if org_id:
        stmt = stmt.where(Dataset.organization_id == org_id)
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


@router.get("/overview")
async def analytics_overview(
    dataset_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    active_dataset_id = await _resolve_dataset_id(db, dataset_id, current_user.organization_id)
    if not active_dataset_id:
        return {"risk_distribution": {}, "overtime_risk": {}}

    risk_stmt = (
        select(Prediction.risk_level, func.count(Prediction.id))
        .where(Prediction.dataset_id == active_dataset_id, Prediction.is_standalone == False)
        .group_by(Prediction.risk_level)
    )
    risk_result = await db.execute(risk_stmt)
    risk_dist = {row[0]: row[1] for row in risk_result.all()}

    ot_stmt = (
        select(
            func.json_extract(Prediction.input_features, "$.overtime").label("ot"),
            func.avg(Prediction.attrition_probability).label("avg_prob"),
        )
        .where(Prediction.dataset_id == active_dataset_id, Prediction.is_standalone == False)
        .group_by("ot")
    )
    ot_result = await db.execute(ot_stmt)
    overtime_risk = {r[0]: round(float(r[1] or 0), 4) for r in ot_result.all() if r[0]}

    return {
        "risk_distribution": risk_dist,
        "overtime_risk": overtime_risk,
    }


@router.get("/department")
async def analytics_department(
    dataset_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    active_dataset_id = await _resolve_dataset_id(db, dataset_id, current_user.organization_id)
    if not active_dataset_id:
        return {"departments": []}

    stmt = (
        select(
            func.json_extract(Prediction.input_features, "$.department").label("dept"),
            Prediction.risk_level,
            func.count(Prediction.id).label("count"),
            func.avg(Prediction.attrition_probability).label("avg_prob"),
        )
        .where(Prediction.dataset_id == active_dataset_id, Prediction.is_standalone == False)
        .group_by("dept", Prediction.risk_level)
    )
    result = await db.execute(stmt)
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
    dataset_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    active_dataset_id = await _resolve_dataset_id(db, dataset_id, current_user.organization_id)
    if not active_dataset_id:
        return {"job_roles": []}

    stmt = (
        select(
            func.json_extract(Prediction.input_features, "$.job_role").label("role"),
            Prediction.risk_level,
            func.count(Prediction.id).label("count"),
            func.avg(Prediction.attrition_probability).label("avg_prob"),
        )
        .where(Prediction.dataset_id == active_dataset_id, Prediction.is_standalone == False)
        .group_by("role", Prediction.risk_level)
    )
    result = await db.execute(stmt)
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
