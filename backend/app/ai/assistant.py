import google.generativeai as genai
from app.utils.config import settings
from app.schemas.chat import EmployeeContextForAI, PredictionContextForAI
from typing import Optional, List

# Configure Gemini once at module load (key stays on backend only)
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)

SYSTEM_PROMPT = """You are an AI HR Analytics Assistant for the Employee Attrition Risk Intelligence System.

Your role:
- Interpret and explain ML-generated attrition risk predictions in plain language
- Help HR professionals understand what factors contribute to estimated attrition risk
- Provide context and analytics insights

Critical constraints you MUST follow:
1. NEVER recommend firing, disciplinary action, denying promotions, or penalizing employees
2. The attrition probability is a MODEL ESTIMATE — it is NOT a certainty
3. Do NOT invent employee information not provided in the context
4. Do NOT make definitive statements like "This employee will leave"
5. Use language like: "the model estimates", "based on the prediction", "this suggests"
6. You are an interpretation assistant, not a decision maker
7. Focus on constructive HR actions: engagement, support, development opportunities
8. Keep responses concise, professional, and actionable"""


def _build_context_message(
    employee_context: Optional[EmployeeContextForAI],
    prediction_context: Optional[PredictionContextForAI],
) -> str:
    """Build structured context to inject into the AI conversation."""
    parts = []

    if employee_context:
        parts.append("=== EMPLOYEE CONTEXT ===")
        parts.append(f"Employee Number: {employee_context.employee_number}")
        if employee_context.department:
            parts.append(f"Department: {employee_context.department}")
        if employee_context.job_role:
            parts.append(f"Job Role: {employee_context.job_role}")
        if employee_context.age:
            parts.append(f"Age: {employee_context.age}")
        if employee_context.years_at_company:
            parts.append(f"Years at Company: {employee_context.years_at_company}")
        if employee_context.overtime:
            parts.append(f"Overtime: {employee_context.overtime}")
        if employee_context.job_satisfaction:
            parts.append(f"Job Satisfaction (1-4): {employee_context.job_satisfaction}")
        if employee_context.work_life_balance:
            parts.append(f"Work-Life Balance (1-4): {employee_context.work_life_balance}")

    if prediction_context:
        parts.append("\n=== ML PREDICTION CONTEXT ===")
        parts.append(f"Estimated Attrition Probability: {prediction_context.attrition_probability * 100:.1f}%")
        parts.append(f"Risk Level: {prediction_context.risk_level}")
        if prediction_context.top_risk_factors:
            parts.append("Top Risk Factors (SHAP analysis):")
            for f in prediction_context.top_risk_factors[:5]:
                name = f.get("display_name", f.get("feature", "Unknown")) if isinstance(f, dict) else str(f)
                val = f.get("shap_value", "") if isinstance(f, dict) else ""
                parts.append(f"  - {name} (contribution: {val})")
        if prediction_context.top_protective_factors:
            parts.append("Top Protective Factors (reducing risk):")
            for f in prediction_context.top_protective_factors[:5]:
                name = f.get("display_name", f.get("feature", "Unknown")) if isinstance(f, dict) else str(f)
                val = f.get("shap_value", "") if isinstance(f, dict) else ""
                parts.append(f"  - {name} (contribution: {val})")

    return "\n".join(parts)


async def get_ai_response(
    message: str,
    employee_context: Optional[EmployeeContextForAI],
    prediction_context: Optional[PredictionContextForAI],
    conversation_history: List[dict],
) -> tuple[str, str]:
    """Call Gemini API and return (reply, model_name)."""
    if not settings.GEMINI_API_KEY:
        return (
            "AI Assistant is not configured. Please add your GEMINI_API_KEY to the backend .env file.",
            "not-configured",
        )

    model = genai.GenerativeModel(
        model_name=settings.GEMINI_MODEL,
        system_instruction=SYSTEM_PROMPT,
    )

    context_str = _build_context_message(employee_context, prediction_context)

    # Build conversation history for multi-turn chat
    history = []
    for turn in conversation_history:
        role = "user" if turn.get("role") == "user" else "model"
        history.append({"role": role, "parts": [turn.get("content", "")]})

    chat = model.start_chat(history=history)

    # Prepend context to current message
    full_message = f"{context_str}\n\n---\n{message}" if context_str else message

    response = await chat.send_message_async(full_message)
    return response.text, settings.GEMINI_MODEL
