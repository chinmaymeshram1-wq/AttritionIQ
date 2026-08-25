from fastapi import APIRouter, Depends, HTTPException
from app.schemas.whatif import WhatIfRequest, WhatIfResponse
from app.services.prediction_service import PredictionService
from app.auth.dependencies import get_current_active_user
from app.models.user import User
from app.utils.config import settings

router = APIRouter()


@router.post("", response_model=WhatIfResponse)
async def what_if_simulation(
    payload: WhatIfRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    MODEL WHAT-IF SIMULATION.
    Runs the ML pipeline on original and modified feature sets.
    Results are model estimates only — not behavioral predictions.
    """
    try:
        service = PredictionService()
        original_prob = service.predict_probability(payload.original.model_dump(exclude={"employee_number"}))
        modified_prob = service.predict_probability(payload.modified.model_dump(exclude={"employee_number"}))

        return WhatIfResponse(
            original_probability=original_prob,
            modified_probability=modified_prob,
            difference=modified_prob - original_prob,
            original_risk_level=settings.get_risk_level(original_prob),
            modified_risk_level=settings.get_risk_level(modified_prob),
            model_version=settings.MODEL_VERSION,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
