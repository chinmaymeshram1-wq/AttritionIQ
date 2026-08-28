import os
import logging
from typing import Optional, List
import google.generativeai as genai
from app.utils.config import settings
from app.schemas.chat import EmployeeContextForAI, PredictionContextForAI

logger = logging.getLogger("attritioniq")

SYSTEM_PROMPT = """You are an AI HR Analytics Assistant for the Employee Attrition Risk Intelligence System (AttritionIQ).

Your role:
- Interpret ML-generated attrition risk predictions and SHAP factor contributions in clear, executive-level language.
- Provide practical, constructive, and non-discriminatory HR retention and talent engagement perspectives.
- Answer general HR analytics, model methodology, and workforce retention questions intelligently.

Formatting Rules:
- Format your response with clear uppercase section headers (e.g. KEY CONTRIBUTING FACTORS, PROTECTIVE FACTORS, WHAT THIS MEANS, RECOMMENDED HR ACTIONS, IMPORTANT NOTE).
- Use clean bullet points (•) and numbered lists (1., 2.) for scannability.
- Do NOT output raw Markdown syntax like ###, **, or * when plain headers and bullets suffice.

Critical Constraints:
1. NEVER recommend firing, disciplinary action, demotion, denying promotions, or penalizing employees.
2. The attrition probability is an ML-based statistical estimate — it is NOT a certainty that an employee will resign.
3. Use objective, probabilistic terms such as "the model estimates", "based on the prediction", "this profile suggests".
4. When employee context is provided, rely ONLY on the supplied dataset values and SHAP metrics for facts. Never fabricate unlisted employee metrics.
5. If prediction data is explicitly marked as unavailable, state clearly: "Employee #[number] was found, but no attrition prediction is currently available."
6. Focus on actionable retention solutions: workload rebalancing, satisfaction reviews, career development, and manager engagement.
7. Maintain professional tone and keep responses structured and concise."""


def _build_context_message(
    employee_context: Optional[EmployeeContextForAI],
    prediction_context: Optional[PredictionContextForAI],
    nlp_normalized_question: Optional[str] = None,
) -> str:
    """Build structured context to inject into the AI conversation."""
    parts = []

    if nlp_normalized_question:
        parts.append("=== NLP INTERPRETATION ===")
        parts.append(f"Target Interpretation: {nlp_normalized_question}")

    if employee_context:
        parts.append("\n=== EMPLOYEE CONTEXT (ACTUAL DATASET RECORD) ===")
        parts.append(f"Employee Number: {employee_context.employee_number}")
        if employee_context.name:
            parts.append(f"Name: {employee_context.name}")
        if employee_context.department:
            parts.append(f"Department: {employee_context.department}")
        if employee_context.job_role:
            parts.append(f"Job Role: {employee_context.job_role}")
        if employee_context.job_level is not None:
            parts.append(f"Job Level: {employee_context.job_level}")
        if employee_context.age is not None:
            parts.append(f"Age: {employee_context.age}")
        if employee_context.gender:
            parts.append(f"Gender: {employee_context.gender}")
        if employee_context.marital_status:
            parts.append(f"Marital Status: {employee_context.marital_status}")
        if employee_context.business_travel:
            parts.append(f"Business Travel: {employee_context.business_travel}")
        if employee_context.education_field:
            parts.append(f"Education Field: {employee_context.education_field}")
        if employee_context.education is not None:
            parts.append(f"Education Level: {employee_context.education}")
        if employee_context.monthly_income is not None:
            parts.append(f"Monthly Income: ${employee_context.monthly_income:,.0f}")
        if employee_context.percent_salary_hike is not None:
            parts.append(f"Percent Salary Hike: {employee_context.percent_salary_hike}%")
        if employee_context.stock_option_level is not None:
            parts.append(f"Stock Option Level: {employee_context.stock_option_level}")
        if employee_context.overtime:
            parts.append(f"Overtime: {employee_context.overtime}")
        if employee_context.job_satisfaction is not None:
            parts.append(f"Job Satisfaction (1-4): {employee_context.job_satisfaction}")
        if employee_context.environment_satisfaction is not None:
            parts.append(f"Environment Satisfaction (1-4): {employee_context.environment_satisfaction}")
        if employee_context.relationship_satisfaction is not None:
            parts.append(f"Relationship Satisfaction (1-4): {employee_context.relationship_satisfaction}")
        if employee_context.work_life_balance is not None:
            parts.append(f"Work-Life Balance (1-4): {employee_context.work_life_balance}")
        if employee_context.job_involvement is not None:
            parts.append(f"Job Involvement (1-4): {employee_context.job_involvement}")
        if employee_context.performance_rating is not None:
            parts.append(f"Performance Rating (1-4): {employee_context.performance_rating}")
        if employee_context.years_at_company is not None:
            parts.append(f"Years at Company: {employee_context.years_at_company}")
        if employee_context.years_in_current_role is not None:
            parts.append(f"Years in Current Role: {employee_context.years_in_current_role}")
        if employee_context.years_since_last_promotion is not None:
            parts.append(f"Years Since Last Promotion: {employee_context.years_since_last_promotion}")
        if employee_context.years_with_curr_manager is not None:
            parts.append(f"Years With Current Manager: {employee_context.years_with_curr_manager}")
        if employee_context.distance_from_home is not None:
            parts.append(f"Distance From Home: {employee_context.distance_from_home} km")
        if employee_context.total_working_years is not None:
            parts.append(f"Total Working Years: {employee_context.total_working_years}")
        if employee_context.training_times_last_year is not None:
            parts.append(f"Training Times Last Year: {employee_context.training_times_last_year}")
        if employee_context.num_companies_worked is not None:
            parts.append(f"Number of Companies Worked: {employee_context.num_companies_worked}")

    if prediction_context:
        parts.append("\n=== STORED MODEL PREDICTION ===")
        parts.append(f"Estimated Attrition Probability: {prediction_context.attrition_probability * 100:.1f}%")
        parts.append(f"Risk Level: {prediction_context.risk_level}")
        if prediction_context.prediction_id:
            parts.append(f"Prediction ID: {prediction_context.prediction_id}")
        if prediction_context.model_version:
            parts.append(f"Model Pipeline: {prediction_context.model_version}")
        if prediction_context.top_risk_factors:
            parts.append("\n=== SHAP RISK FACTORS (POSITIVE ATTRITION ELEVATORS) ===")
            for f in prediction_context.top_risk_factors:
                name = f.get("display_name", f.get("feature", "Unknown")) if isinstance(f, dict) else str(f)
                val = f.get("shap_value", "") if isinstance(f, dict) else ""
                val_str = f"+{val:.3f}" if isinstance(val, (int, float)) and val > 0 else f"{val}"
                parts.append(f"  • {name}: {val_str}")
        if prediction_context.top_protective_factors:
            parts.append("\n=== SHAP PROTECTIVE FACTORS (NEGATIVE RISK REDUCERS) ===")
            for f in prediction_context.top_protective_factors:
                name = f.get("display_name", f.get("feature", "Unknown")) if isinstance(f, dict) else str(f)
                val = f.get("shap_value", "") if isinstance(f, dict) else ""
                val_str = f"{val:.3f}" if isinstance(val, (int, float)) else f"{val}"
                parts.append(f"  • {name}: {val_str}")
    elif employee_context:
        parts.append("\n=== STORED MODEL PREDICTION ===")
        parts.append("ML Prediction status: No prediction has been run for this employee yet.")

    return "\n".join(parts)


def sanitize_history(conversation_history: List[dict], current_message: str) -> List[dict]:
    """Sanitize history for Gemini API multi-turn alternation."""
    if not conversation_history:
        return []

    raw = []
    for turn in conversation_history:
        role = "user" if turn.get("role") in ["user", "human"] else "model"
        content = (turn.get("content") or "").strip()
        if content:
            raw.append({"role": role, "content": content})

    if not raw:
        return []

    if raw[-1]["role"] == "user":
        raw.pop()

    if not raw:
        return []

    sanitized = []
    for item in raw:
        if not sanitized:
            if item["role"] == "user":
                sanitized.append({"role": "user", "parts": [item["content"]]})
        else:
            prev_role = sanitized[-1]["role"]
            if item["role"] != prev_role:
                sanitized.append({"role": item["role"], "parts": [item["content"]]})
            else:
                sanitized[-1]["parts"].append(item["content"])

    while sanitized and sanitized[-1]["role"] == "user":
        sanitized.pop()

    return sanitized


async def get_ai_response(
    message: str,
    employee_context: Optional[EmployeeContextForAI],
    prediction_context: Optional[PredictionContextForAI],
    conversation_history: List[dict],
    nlp_normalized_question: Optional[str] = None,
    custom_context_override: Optional[str] = None,
) -> tuple[str, str]:
    """Call Gemini API using configured model with history sanitization and single-turn fallback."""
    api_key = (settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "")).strip()

    if not api_key:
        logger.warning("[AI] Gemini API key configured: false")
        return (
            "AI Assistant is not configured. Please add your GEMINI_API_KEY to the backend environment variables.",
            "not-configured",
        )

    genai.configure(api_key=api_key)

    model_name = (
        (settings.GEMINI_MODEL or os.environ.get("GEMINI_MODEL", "")).strip()
        or "gemini-1.5-flash"
    )

    context_str = custom_context_override or _build_context_message(
        employee_context, prediction_context, nlp_normalized_question
    )
    full_message = f"{context_str}\n\n---\n{message}" if context_str else message
    sanitized_history = sanitize_history(conversation_history, message)

    try:
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=SYSTEM_PROMPT,
        )

        if sanitized_history:
            try:
                chat = model.start_chat(history=sanitized_history)
                response = await chat.send_message_async(full_message)
                return response.text, model_name
            except Exception as chat_err:
                logger.warning(f"[AI] Multi-turn chat failed with model '{model_name}': {chat_err}. Falling back to single-turn.")

        response = await model.generate_content_async(full_message)
        return response.text, model_name

    except Exception as err:
        logger.error(f"[AI] Gemini API request failed: {type(err).__name__}: {err}", exc_info=True)
        raise err
