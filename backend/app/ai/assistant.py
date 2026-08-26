import os
import logging
from typing import Optional, List
import google.generativeai as genai
from app.utils.config import settings
from app.schemas.chat import EmployeeContextForAI, PredictionContextForAI

logger = logging.getLogger("attritioniq")

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


def sanitize_history(conversation_history: List[dict], current_message: str) -> List[dict]:
    """
    Sanitize history for Gemini API:
    1. Gemini requires alternating roles: user, model, user, model...
    2. If the last message in history is the current user message, remove it since
       send_message_async appends the new user message.
    3. Gemini multi-turn history must end with a 'model' turn.
    """
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

    # If the last item in history matches the current user message or is a trailing user turn, drop it
    if raw[-1]["role"] == "user":
        raw.pop()

    if not raw:
        return []

    # Ensure strict alternation starting with 'user'
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

    # Ensure history ends with 'model'
    while sanitized and sanitized[-1]["role"] == "user":
        sanitized.pop()

    return sanitized


def normalize_model_name(model_name: str) -> str:
    """Normalize model name and provide fallback for unsupported/misconfigured model strings."""
    if not model_name:
        return "gemini-1.5-flash"

    clean = model_name.strip()

    # Map unknown or typo model names like gemini-3.6-flash to supported production models
    if "3.6" in clean or "3." in clean or "unknown" in clean.lower():
        logger.warning(f"[AI] Model '{clean}' is not recognized. Falling back to 'gemini-1.5-flash'")
        return "gemini-1.5-flash"

    return clean


async def get_ai_response(
    message: str,
    employee_context: Optional[EmployeeContextForAI],
    prediction_context: Optional[PredictionContextForAI],
    conversation_history: List[dict],
) -> tuple[str, str]:
    """Call Gemini API and return (reply, model_name) with safe fallback."""
    api_key = (settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "")).strip()

    if not api_key:
        print("[AI] Gemini API key configured: false", flush=True)
        logger.warning("[AI] Gemini API key configured: false")
        return (
            "AI Assistant is not configured. Please add your GEMINI_API_KEY to the backend environment variables in Render.",
            "not-configured",
        )

    print(f"[AI] Gemini API key configured: true (length: {len(api_key)})", flush=True)
    logger.info(f"[AI] Gemini API key configured: true (length: {len(api_key)})")

    # Configure Gemini with current key
    genai.configure(api_key=api_key)

    raw_model = (settings.GEMINI_MODEL or os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")).strip()
    model_name = normalize_model_name(raw_model)

    print(f"[AI] Requesting Gemini with model: {model_name}", flush=True)
    logger.info(f"[AI] Requesting Gemini with model: {model_name}")

    context_str = _build_context_message(employee_context, prediction_context)
    full_message = f"{context_str}\n\n---\n{message}" if context_str else message
    sanitized_history = sanitize_history(conversation_history, message)

    models_to_try = [model_name]
    for fallback in ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro"]:
        if fallback not in models_to_try:
            models_to_try.append(fallback)

    last_error = None
    for current_model in models_to_try:
        try:
            model = genai.GenerativeModel(
                model_name=current_model,
                system_instruction=SYSTEM_PROMPT,
            )

            if sanitized_history:
                try:
                    chat = model.start_chat(history=sanitized_history)
                    response = await chat.send_message_async(full_message)
                    print(f"[AI] Gemini response generated successfully with model: {current_model}", flush=True)
                    logger.info(f"[AI] Gemini response generated successfully with model: {current_model}")
                    return response.text, current_model
                except Exception as chat_err:
                    logger.warning(f"[AI] Multi-turn chat failed with {current_model}: {chat_err}. Falling back to single-turn generation.")

            response = await model.generate_content_async(full_message)
            print(f"[AI] Gemini response generated successfully with model: {current_model}", flush=True)
            logger.info(f"[AI] Gemini response generated successfully with model: {current_model}")
            return response.text, current_model

        except Exception as err:
            last_error = err
            err_str = str(err)
            print(f"[AI] Gemini API request failed with model {current_model}: {type(err).__name__}: {err_str}", flush=True)
            logger.warning(f"[AI] Gemini API request failed with model {current_model}: {type(err).__name__}: {err_str}")
            if "404" in err_str or "not found" in err_str.lower() or "invalid" in err_str.lower():
                continue
            raise err

    if last_error:
        raise last_error

    return "Unable to generate response from AI Assistant.", "error"
