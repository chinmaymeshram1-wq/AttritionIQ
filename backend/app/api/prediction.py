from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.schemas.prediction import (
    IndividualPredictionRequest,
    PredictionResponse,
    BatchPredictionResponse,
    CompatibilityReport as CompatibilityReportSchema,
)
from app.services.prediction_service import PredictionService
from app.services.batch_service import BatchService
from app.auth.dependencies import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.post("/individual", response_model=PredictionResponse)
async def individual_prediction(
    payload: IndividualPredictionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        service = PredictionService(db=db)
        result = await service.predict_individual(payload)
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@router.post("/batch", response_model=BatchPredictionResponse)
async def batch_prediction(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:  # 10 MB
        raise HTTPException(status_code=413, detail="File too large. Maximum 10 MB.")

    try:
        batch_service = BatchService(db=db)
        result = await batch_service.process_batch(content)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch processing failed: {str(e)}")


@router.post("/batch/check-compatibility", response_model=CompatibilityReportSchema)
async def check_batch_compatibility(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
):
    """
    Pre-flight compatibility check for an HR CSV file.

    Analyzes the uploaded CSV's columns against the 31-feature canonical schema
    required by the trained model and returns a CompatibilityReport.
    No predictions are generated; no database writes occur.
    """
    import io
    import pandas as pd
    from app.utils.dataset_compatibility import analyze_csv_compatibility

    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum 10 MB.")

    try:
        df = pd.read_csv(io.BytesIO(content))
        report = analyze_csv_compatibility(df)
        return CompatibilityReportSchema(**report.model_dump())
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Compatibility check failed: {str(e)}",
        )


@router.get("/explanation/{prediction_id}")
async def get_explanation(
    prediction_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    from sqlalchemy import select
    from app.models.prediction_explanation import PredictionExplanation

    result = await db.execute(
        select(PredictionExplanation).where(PredictionExplanation.prediction_id == prediction_id)
    )
    explanation = result.scalar_one_or_none()
    if not explanation:
        raise HTTPException(status_code=404, detail="Explanation not found")
    return {
        "prediction_id": prediction_id,
        "top_risk_factors": explanation.top_risk_factors,
        "top_protective_factors": explanation.top_protective_factors,
        "base_value": explanation.base_value,
    }
