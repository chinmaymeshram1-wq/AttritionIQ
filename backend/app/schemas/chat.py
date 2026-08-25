from pydantic import BaseModel
from typing import Optional


class EmployeeContextForAI(BaseModel):
    employee_number: int
    department: Optional[str] = None
    job_role: Optional[str] = None
    age: Optional[int] = None
    years_at_company: Optional[int] = None
    overtime: Optional[str] = None
    job_satisfaction: Optional[int] = None
    work_life_balance: Optional[int] = None


class PredictionContextForAI(BaseModel):
    attrition_probability: float
    risk_level: str
    top_risk_factors: Optional[list] = None
    top_protective_factors: Optional[list] = None


class ChatRequest(BaseModel):
    message: str
    employee_context: Optional[EmployeeContextForAI] = None
    prediction_context: Optional[PredictionContextForAI] = None
    conversation_history: Optional[list] = None  # [{role, content}]


class ChatResponse(BaseModel):
    reply: str
    model_used: str
