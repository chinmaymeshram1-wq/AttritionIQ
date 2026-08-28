import re
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class NLPIntent(str, Enum):
    GENERAL_HR = "GENERAL_HR"
    EMPLOYEE_OVERVIEW = "EMPLOYEE_OVERVIEW"
    EMPLOYEE_RISK = "EMPLOYEE_RISK"
    RISK_FACTORS = "RISK_FACTORS"
    PROTECTIVE_FACTORS = "PROTECTIVE_FACTORS"
    SHAP_EXPLANATION = "SHAP_EXPLANATION"
    RETENTION_RECOMMENDATION = "RETENTION_RECOMMENDATION"
    PREDICTION_EXPLANATION = "PREDICTION_EXPLANATION"
    EMPLOYEE_COMPARISON = "EMPLOYEE_COMPARISON"
    FOLLOW_UP = "FOLLOW_UP"


class NLPIntentResult(BaseModel):
    intent: NLPIntent
    employee_ids: List[str] = Field(default_factory=list)
    active_employee_id: Optional[str] = None
    entities: List[str] = Field(default_factory=list)
    confidence: float = 1.0
    normalized_question: str = ""
    is_follow_up: bool = False


# Regex pattern to capture explicit employee IDs while avoiding arbitrary numbers (e.g. "10 years", "50k salary")
EMP_ID_REGEX = re.compile(
    r"(?:employee|emp|staff|worker)\s*(?:number|no\.?|id|code)?\s*#?\s*(\d+)"
    r"|(?:^|\s)id\s*#?\s*(\d+)\b"
    r"|(?:^|\s)#(\d+)\b",
    re.IGNORECASE,
)

# Common follow-up phrases / pronouns referencing an active employee
FOLLOW_UP_PHRASES = [
    "this employee",
    "this person",
    "the employee",
    "the risk",
    "this risk",
    "those factors",
    "these factors",
    "the factors",
    "what should hr do",
    "what can hr do",
    "why is it high",
    "why is the risk high",
    "why is he",
    "why is she",
    "why is risk so high",
    "what are the main reasons",
    "what are the top factors",
    "he",
    "she",
    "they",
    "him",
    "her",
]


def extract_employee_ids(text: str) -> List[str]:
    """Extract all explicit employee IDs from text, preserving order and uniqueness."""
    if not text:
        return []
    ids = []
    seen = set()
    for match in EMP_ID_REGEX.finditer(text):
        emp_id = match.group(1) or match.group(2) or match.group(3)
        if emp_id and emp_id not in seen:
            seen.add(emp_id)
            ids.append(emp_id)
    return ids


def is_follow_up_phrase(text: str) -> bool:
    """Check if query contains follow-up indicators or pronouns pointing to active context."""
    t_lower = text.lower()
    for phrase in FOLLOW_UP_PHRASES:
        if phrase in t_lower:
            return True
    return False


def interpret_user_request(
    message: str,
    payload_employee_id: Optional[Any] = None,
    payload_employee_context: Optional[Any] = None,
    conversation_history: Optional[List[Dict[str, Any]]] = None,
) -> NLPIntentResult:
    """
    Lightweight NLP Interpreter:
    1. Extracts explicit employee IDs from current message.
    2. Resolves active employee context (Current Msg > Payload > Conversation History > None).
    3. Detects intent & entities using keyword/phrase pattern matching.
    4. Generates a normalized interpretation question for Gemini context.
    """
    message_clean = (message or "").strip()
    msg_lower = message_clean.lower()

    # 1. Extract explicit employee IDs from current message
    current_msg_ids = extract_employee_ids(message_clean)

    # 2. Determine active employee ID and follow-up status
    active_id: Optional[str] = None
    is_follow_up = False

    if current_msg_ids:
        active_id = current_msg_ids[0]
    elif payload_employee_id is not None and str(payload_employee_id).strip() != "":
        active_id = str(payload_employee_id).strip().lstrip("#")
        is_follow_up = True
    elif (
        payload_employee_context
        and getattr(payload_employee_context, "employee_number", None) is not None
    ):
        active_id = str(payload_employee_context.employee_number).strip().lstrip("#")
        is_follow_up = True
    elif conversation_history:
        for turn in reversed(conversation_history):
            if turn.get("role") == "user" and turn.get("content"):
                hist_ids = extract_employee_ids(str(turn["content"]))
                if hist_ids:
                    active_id = hist_ids[0]
                    is_follow_up = True
                    break

    # If message has follow-up phrases, mark as follow up
    if active_id and not current_msg_ids and is_follow_up_phrase(message_clean):
        is_follow_up = True

    # 3. Detect Entities
    entities = []
    if "shap" in msg_lower or "shapley" in msg_lower:
        entities.append("shap")
    if "attrition" in msg_lower or "leave" in msg_lower or "resign" in msg_lower:
        entities.append("attrition")
    if "risk" in msg_lower:
        entities.append("risk")
    if "overtime" in msg_lower:
        entities.append("overtime")
    if "satisfaction" in msg_lower:
        entities.append("satisfaction")
    if "recommend" in msg_lower or "action" in msg_lower or "hr" in msg_lower:
        entities.append("recommendation")

    # 4. Intent Detection
    confidence = 0.95
    intent = NLPIntent.GENERAL_HR

    if len(current_msg_ids) >= 2 or any(k in msg_lower for k in ["compare", "versus", " vs ", "difference between"]):
        intent = NLPIntent.EMPLOYEE_COMPARISON
        confidence = 0.95
    elif any(k in msg_lower for k in ["explain shap", "what is shap", "shap values"]):
        intent = NLPIntent.SHAP_EXPLANATION
        confidence = 0.95
    elif any(k in msg_lower for k in ["probability mean", "what does", "percent attrition", "risk score mean"]):
        intent = NLPIntent.PREDICTION_EXPLANATION
        confidence = 0.90
    elif any(k in msg_lower for k in ["recommend", "action", "what should hr do", "what can hr do", "retention strategy", "intervene"]):
        intent = NLPIntent.RETENTION_RECOMMENDATION
        confidence = 0.95
    elif any(k in msg_lower for k in ["protect", "protective", "reducer", "positive factor"]):
        intent = NLPIntent.PROTECTIVE_FACTORS
        confidence = 0.95
    elif any(k in msg_lower for k in ["risk factor", "driving", "reason", "why is", "contributing", "top factor", "strongest factor"]):
        intent = NLPIntent.RISK_FACTORS
        confidence = 0.95
    elif any(k in msg_lower for k in ["risk", "high risk", "risk level", "attrition risk"]):
        intent = NLPIntent.EMPLOYEE_RISK
        confidence = 0.90
    elif any(k in msg_lower for k in ["tell me about", "overview", "complete analysis", "profile", "insights for"]):
        intent = NLPIntent.EMPLOYEE_OVERVIEW
        confidence = 0.95
    elif active_id and is_follow_up:
        intent = NLPIntent.FOLLOW_UP
        confidence = 0.85

    # Default logic for unmatched intent when active employee exists
    if intent == NLPIntent.GENERAL_HR and active_id:
        intent = NLPIntent.EMPLOYEE_OVERVIEW
        confidence = 0.80

    # 5. Build Normalized Question
    normalized_q = message_clean
    if intent == NLPIntent.EMPLOYEE_COMPARISON and len(current_msg_ids) >= 2:
        normalized_q = f"Compare attrition risk profile and SHAP drivers for Employee #{current_msg_ids[0]} and Employee #{current_msg_ids[1]}."
    elif active_id:
        if intent == NLPIntent.RETENTION_RECOMMENDATION:
            normalized_q = f"What retention actions should HR consider for Employee #{active_id} based on the available risk factors?"
        elif intent in (NLPIntent.RISK_FACTORS, NLPIntent.EMPLOYEE_RISK, NLPIntent.FOLLOW_UP):
            normalized_q = f"Why is Employee #{active_id} estimated to have elevated attrition risk, and what are the primary contributing factors?"
        elif intent == NLPIntent.PROTECTIVE_FACTORS:
            normalized_q = f"What protective or risk-reducing factors exist for Employee #{active_id}?"
        elif intent == NLPIntent.EMPLOYEE_OVERVIEW:
            normalized_q = f"Provide a complete overview and attrition risk analysis for Employee #{active_id}."
    else:
        if intent == NLPIntent.GENERAL_HR:
            normalized_q = f"Provide general HR analytics insights regarding: {message_clean}"

    return NLPIntentResult(
        intent=intent,
        employee_ids=current_msg_ids,
        active_employee_id=active_id,
        entities=entities,
        confidence=confidence,
        normalized_question=normalized_q,
        is_follow_up=is_follow_up,
    )
