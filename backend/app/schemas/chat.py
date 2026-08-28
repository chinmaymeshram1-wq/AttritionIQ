from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class EmployeeContextForAI(BaseModel):
    employee_number: Optional[int | str] = None
    name: Optional[str] = None
    department: Optional[str] = None
    job_role: Optional[str] = None
    job_level: Optional[int] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    business_travel: Optional[str] = None
    education: Optional[int] = None
    education_field: Optional[str] = None
    monthly_income: Optional[float] = None
    percent_salary_hike: Optional[int] = None
    stock_option_level: Optional[int] = None
    overtime: Optional[str] = None
    job_satisfaction: Optional[int] = None
    environment_satisfaction: Optional[int] = None
    relationship_satisfaction: Optional[int] = None
    work_life_balance: Optional[int] = None
    job_involvement: Optional[int] = None
    performance_rating: Optional[int] = None
    years_at_company: Optional[int] = None
    years_in_current_role: Optional[int] = None
    years_since_last_promotion: Optional[int] = None
    years_with_curr_manager: Optional[int] = None
    distance_from_home: Optional[int] = None
    total_working_years: Optional[int] = None
    training_times_last_year: Optional[int] = None
    num_companies_worked: Optional[int] = None


class PredictionContextForAI(BaseModel):
    attrition_probability: float
    risk_level: str
    prediction_id: Optional[str] = None
    model_version: Optional[str] = None
    predicted_at: Optional[str] = None
    top_risk_factors: Optional[List[Any]] = None
    top_protective_factors: Optional[List[Any]] = None
    base_value: Optional[float] = None


class ChatRequest(BaseModel):
    message: str
    employee_id: Optional[str] = None
    employee_context: Optional[EmployeeContextForAI] = None
    prediction_context: Optional[PredictionContextForAI] = None
    conversation_history: Optional[List[Dict[str, Any]]] = None  # [{role, content}]


class ChatResponse(BaseModel):
    reply: str
    model_used: str
