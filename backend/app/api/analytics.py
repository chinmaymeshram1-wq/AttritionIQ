from typing import Optional, Dict, Any, List
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

    # Fetch predictions for this dataset (excluding standalone predictions)
    stmt = (
        select(Prediction.risk_level, Prediction.attrition_probability, Prediction.input_features)
        .where(Prediction.dataset_id == active_dataset_id, Prediction.is_standalone == False)
    )
    result = await db.execute(stmt)
    predictions = result.all()

    risk_dist: Dict[str, int] = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    ot_groups: Dict[str, List[float]] = {}

    for risk_level, prob, features in predictions:
        if risk_level in risk_dist:
            risk_dist[risk_level] += 1
        else:
            risk_dist[risk_level] = 1

        if features and isinstance(features, dict):
            # Check for overtime field (handles 'overtime' or 'OverTime' or 'over_time')
            ot_val = features.get("overtime") or features.get("OverTime") or features.get("over_time")
            if ot_val:
                ot_str = str(ot_val).strip()
                if ot_str not in ot_groups:
                    ot_groups[ot_str] = []
                ot_groups[ot_str].append(float(prob))

    overtime_risk: Dict[str, float] = {}
    for ot_val, probs in ot_groups.items():
        if probs:
            overtime_risk[ot_val] = round(sum(probs) / len(probs), 4)

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
        select(Prediction.risk_level, Prediction.attrition_probability, Prediction.input_features)
        .where(Prediction.dataset_id == active_dataset_id, Prediction.is_standalone == False)
    )
    result = await db.execute(stmt)
    predictions = result.all()

    agg: Dict[str, Dict[str, Any]] = {}

    for risk_level, prob, features in predictions:
        dept = None
        if features and isinstance(features, dict):
            dept = features.get("department") or features.get("Department")
        if not dept:
            continue
        dept_str = str(dept).strip()

        if dept_str not in agg:
            agg[dept_str] = {
                "department": dept_str,
                "HIGH": 0,
                "MEDIUM": 0,
                "LOW": 0,
                "total": 0,
                "_probs": [],
            }

        if risk_level in ("HIGH", "MEDIUM", "LOW"):
            agg[dept_str][risk_level] += 1
        agg[dept_str]["total"] += 1
        agg[dept_str]["_probs"].append(float(prob))

    departments_list = []
    for dept_str, data in agg.items():
        probs = data.pop("_probs")
        data["avg_probability"] = round(sum(probs) / len(probs), 4) if probs else 0.0
        departments_list.append(data)

    return {"departments": departments_list}


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
        select(Prediction.risk_level, Prediction.attrition_probability, Prediction.input_features)
        .where(Prediction.dataset_id == active_dataset_id, Prediction.is_standalone == False)
    )
    result = await db.execute(stmt)
    predictions = result.all()

    agg: Dict[str, Dict[str, Any]] = {}

    for risk_level, prob, features in predictions:
        role = None
        if features and isinstance(features, dict):
            role = features.get("job_role") or features.get("JobRole")
        if not role:
            continue
        role_str = str(role).strip()

        if role_str not in agg:
            agg[role_str] = {
                "job_role": role_str,
                "HIGH": 0,
                "MEDIUM": 0,
                "LOW": 0,
                "total": 0,
                "_probs": [],
            }

        if risk_level in ("HIGH", "MEDIUM", "LOW"):
            agg[role_str][risk_level] += 1
        agg[role_str]["total"] += 1
        agg[role_str]["_probs"].append(float(prob))

    roles_list = []
    for role_str, data in agg.items():
        probs = data.pop("_probs")
        data["avg_probability"] = round(sum(probs) / len(probs), 4) if probs else 0.0
        roles_list.append(data)

    return {"job_roles": roles_list}
