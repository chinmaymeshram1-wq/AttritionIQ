from pydantic import BaseModel
from app.schemas.prediction import IndividualPredictionRequest


class WhatIfRequest(BaseModel):
    original: IndividualPredictionRequest
    modified: IndividualPredictionRequest


class WhatIfResponse(BaseModel):
    original_probability: float
    modified_probability: float
    difference: float  # modified - original (negative = improvement)
    original_risk_level: str
    modified_risk_level: str
    model_version: str
