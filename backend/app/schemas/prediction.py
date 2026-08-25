from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict, Literal
from datetime import datetime


# ── Input schema for individual prediction ─────────────────────────────────────
class IndividualPredictionRequest(BaseModel):
    # Employee identifier (stored but NOT used as ML feature)
    employee_number: int = Field(..., gt=0)

    # Demographics
    age: int = Field(..., ge=18, le=70)
    gender: str
    marital_status: str
    education: int = Field(..., ge=1, le=5)
    education_field: str

    # Job
    department: str
    job_role: str
    job_level: int = Field(..., ge=1, le=5)
    business_travel: str
    overtime: str  # Yes | No

    # Compensation
    monthly_income: float = Field(..., gt=0)
    percent_salary_hike: int = Field(..., ge=0, le=100)
    stock_option_level: int = Field(..., ge=0, le=3)

    # Experience
    total_working_years: int = Field(..., ge=0)
    years_at_company: int = Field(..., ge=0)
    years_in_current_role: int = Field(..., ge=0)
    years_since_last_promotion: int = Field(..., ge=0)
    years_with_curr_manager: int = Field(..., ge=0)
    num_companies_worked: int = Field(..., ge=0)

    # Satisfaction
    job_satisfaction: int = Field(..., ge=1, le=4)
    environment_satisfaction: int = Field(..., ge=1, le=4)
    relationship_satisfaction: int = Field(..., ge=1, le=4)
    work_life_balance: int = Field(..., ge=1, le=4)
    job_involvement: int = Field(..., ge=1, le=4)

    # Additional features required by the trained pipeline
    distance_from_home: int = Field(..., ge=0)
    hourly_rate: float = Field(..., gt=0)
    daily_rate: float = Field(..., gt=0)
    monthly_rate: float = Field(..., gt=0)
    training_times_last_year: int = Field(..., ge=0)
    performance_rating: int = Field(..., ge=1, le=4)


# ── Output schemas ─────────────────────────────────────────────────────────────
class ShapFactor(BaseModel):
    feature: str
    display_name: str
    shap_value: float
    feature_value: Any


class PredictionExplanationSchema(BaseModel):
    top_risk_factors: List[ShapFactor]
    top_protective_factors: List[ShapFactor]
    base_value: float


class PredictionResponse(BaseModel):
    prediction_id: str
    employee_number: int
    attrition_probability: float
    risk_level: str  # LOW | MEDIUM | HIGH
    model_version: str
    explanation: Optional[PredictionExplanationSchema] = None
    predicted_at: datetime


# ── Batch schemas ──────────────────────────────────────────────────────────────
class BatchPredictionRecord(BaseModel):
    employee_number: int
    attrition_probability: float
    risk_level: str
    prediction_id: str
    is_estimated: bool = False  # True when prediction was made with missing features


class BatchValidationError(BaseModel):
    row: int
    employee_number: Optional[int] = None
    errors: List[str]


class CompatibilityReport(BaseModel):
    """
    Dataset compatibility report returned before / alongside batch prediction.
    Mirrors ``app.utils.dataset_compatibility.CompatibilityReport``.
    """
    status: Literal["FULLY_COMPATIBLE", "PARTIALLY_COMPATIBLE", "INCOMPATIBLE"]
    features_found: int
    features_required: int
    data_completeness_percentage: float
    mapped_columns: Dict[str, str]           # upload_col → canonical_name
    mapping_confidence: Dict[str, float]     # canonical_name → confidence
    mapping_method: Dict[str, str]           # canonical_name → resolution method
    missing_features: List[str]
    unrecognized_columns: List[str]
    employee_id_column: Optional[str]
    is_estimated: bool
    estimated_prediction_safe: bool


class BatchPredictionResponse(BaseModel):
    total_rows: int
    successful: int
    failed: int
    validation_errors: List[BatchValidationError]
    results: List[BatchPredictionRecord]
    download_url: Optional[str] = None
    compatibility_report: Optional[CompatibilityReport] = None  # NEW — always present
