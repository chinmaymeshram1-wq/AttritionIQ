import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.schemas.chat import ChatRequest, ChatResponse, EmployeeContextForAI, PredictionContextForAI
from app.ai.assistant import get_ai_response
from app.auth.dependencies import get_current_active_user
from app.database.session import get_db
from app.models.employee import Employee
from app.models.prediction import Prediction
from app.models.prediction_explanation import PredictionExplanation
from app.models.user import User

router = APIRouter()


def build_employee_context_from_snapshot(snapshot: dict, emp_num: int | str) -> EmployeeContextForAI:
    """Build EmployeeContextForAI strictly using Employee.feature_snapshot as source of truth."""
    snapshot = snapshot or {}

    def _val(keys: list[str], type_cast=None):
        for k in keys:
            if k in snapshot and snapshot[k] is not None:
                v = snapshot[k]
                if type_cast is int:
                    try:
                        return int(v)
                    except (ValueError, TypeError):
                        pass
                elif type_cast is float:
                    try:
                        return float(v)
                    except (ValueError, TypeError):
                        pass
                else:
                    return str(v)
        return None

    return EmployeeContextForAI(
        employee_number=emp_num,
        name=_val(["name", "EmployeeName", "full_name"]),
        department=_val(["department", "Department"]),
        job_role=_val(["job_role", "JobRole"]),
        job_level=_val(["job_level", "JobLevel"], int),
        age=_val(["age", "Age"], int),
        gender=_val(["gender", "Gender"]),
        marital_status=_val(["marital_status", "MaritalStatus"]),
        business_travel=_val(["business_travel", "BusinessTravel"]),
        education=_val(["education", "Education"], int),
        education_field=_val(["education_field", "EducationField"]),
        monthly_income=_val(["monthly_income", "MonthlyIncome"], float),
        percent_salary_hike=_val(["percent_salary_hike", "PercentSalaryHike"], int),
        stock_option_level=_val(["stock_option_level", "StockOptionLevel"], int),
        overtime=_val(["overtime", "over_time", "OverTime"]),
        job_satisfaction=_val(["job_satisfaction", "JobSatisfaction"], int),
        environment_satisfaction=_val(["environment_satisfaction", "EnvironmentSatisfaction"], int),
        relationship_satisfaction=_val(["relationship_satisfaction", "RelationshipSatisfaction"], int),
        work_life_balance=_val(["work_life_balance", "WorkLifeBalance"], int),
        job_involvement=_val(["job_involvement", "JobInvolvement"], int),
        performance_rating=_val(["performance_rating", "PerformanceRating"], int),
        years_at_company=_val(["years_at_company", "YearsAtCompany"], int),
        years_in_current_role=_val(["years_in_current_role", "YearsInCurrentRole"], int),
        years_since_last_promotion=_val(["years_since_last_promotion", "YearsSinceLastPromotion"], int),
        years_with_curr_manager=_val(["years_with_curr_manager", "YearsWithCurrManager"], int),
        distance_from_home=_val(["distance_from_home", "DistanceFromHome"], int),
        total_working_years=_val(["total_working_years", "TotalWorkingYears"], int),
        training_times_last_year=_val(["training_times_last_year", "TrainingTimesLastYear"], int),
        num_companies_worked=_val(["num_companies_worked", "NumCompaniesWorked"], int),
    )


@router.post("/chat", response_model=ChatResponse)
async def ai_chat(
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """AI HR Assistant — retrieves actual DB employee records and prediction context before invoking Gemini."""
    try:
        # Priority order for employee identification:
        # 1. Regex extraction from current message (if user explicitly specifies an employee number in prompt)
        # 2. payload.employee_id
        # 3. payload.employee_context.employee_number
        # 4. Regex extraction from conversation history as fallback
        target_emp_id: Optional[str] = None
        emp_pattern = r"(?:employee|emp|id|staff|worker)\s*(?:number|no\.?|id|code)?\s*#?\s*(\d+)|(?:^|\s)#(\d+)\b"

        text_to_search = payload.message or ""
        msg_match = re.search(emp_pattern, text_to_search, re.IGNORECASE)

        if msg_match:
            target_emp_id = msg_match.group(1) or msg_match.group(2)
        elif payload.employee_id is not None and str(payload.employee_id).strip() != "":
            target_emp_id = str(payload.employee_id).strip()
        elif payload.employee_context and payload.employee_context.employee_number is not None:
            target_emp_id = str(payload.employee_context.employee_number).strip()
        elif payload.conversation_history:
            for turn in reversed(payload.conversation_history):
                if turn.get("role") == "user" and turn.get("content"):
                    hist_match = re.search(emp_pattern, turn["content"], re.IGNORECASE)
                    if hist_match:
                        target_emp_id = hist_match.group(1) or hist_match.group(2)
                        break

        emp_context = payload.employee_context
        pred_context = payload.prediction_context

        if target_emp_id:
            emp_num_int = None
            try:
                emp_num_int = int(target_emp_id)
            except (ValueError, TypeError):
                pass

            # Query Employee record from database
            stmt = select(Employee)
            if emp_num_int is not None:
                stmt = stmt.where((Employee.employee_number == emp_num_int) | (Employee.id == target_emp_id))
            else:
                stmt = stmt.where(Employee.id == target_emp_id)

            res = await db.execute(stmt)
            db_employee = res.scalars().first()

            if db_employee:
                snapshot = db_employee.feature_snapshot or {}
                emp_num = db_employee.employee_number
                emp_context = build_employee_context_from_snapshot(snapshot, emp_num)

                # Retrieve LATEST prediction for this employee
                pred_stmt = select(Prediction)
                if emp_num_int is not None:
                    pred_stmt = pred_stmt.where(
                        (Prediction.employee_number == emp_num_int) | (Prediction.employee_id == db_employee.id)
                    )
                else:
                    pred_stmt = pred_stmt.where(Prediction.employee_id == db_employee.id)

                pred_stmt = pred_stmt.order_by(desc(Prediction.created_at)).limit(1)
                pred_res = await db.execute(pred_stmt)
                db_prediction = pred_res.scalars().first()

                if db_prediction:
                    exp_stmt = select(PredictionExplanation).where(
                        PredictionExplanation.prediction_id == db_prediction.id
                    )
                    exp_res = await db.execute(exp_stmt)
                    db_explanation = exp_res.scalars().first()

                    top_risk = db_explanation.top_risk_factors if db_explanation else None
                    top_prot = db_explanation.top_protective_factors if db_explanation else None
                    base_val = db_explanation.base_value if db_explanation else None

                    pred_context = PredictionContextForAI(
                        attrition_probability=db_prediction.attrition_probability,
                        risk_level=db_prediction.risk_level,
                        prediction_id=db_prediction.id,
                        model_version=db_prediction.model_version,
                        predicted_at=str(db_prediction.created_at) if db_prediction.created_at else None,
                        top_risk_factors=top_risk,
                        top_protective_factors=top_prot,
                        base_value=base_val,
                    )
                else:
                    pred_context = None
            else:
                # Employee not in DB and no complete context provided in request
                if not (emp_context and (emp_context.department or emp_context.job_role or emp_context.age is not None)):
                    clean_id = target_emp_id.lstrip("#")
                    return ChatResponse(
                        reply=f"Employee #{clean_id} was not found.",
                        model_used="system",
                    )

        reply, model_used = await get_ai_response(
            message=payload.message,
            employee_context=emp_context,
            prediction_context=pred_context,
            conversation_history=payload.conversation_history or [],
        )
        return ChatResponse(reply=reply, model_used=model_used)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")
