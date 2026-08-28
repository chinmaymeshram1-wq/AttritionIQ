import uuid
import pytest
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database.session import AsyncSessionLocal
from app.database.seed import seed_initial_data
from app.models.employee import Employee
from app.models.prediction import Prediction
from app.models.prediction_explanation import PredictionExplanation
from app.ai.nlp import interpret_user_request, NLPIntent


async def get_authenticated_client():
    async with AsyncSessionLocal() as session:
        await seed_initial_data(session)
    ac = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    login_res = await ac.post(
        "/auth/login",
        json={"email": "chinmay.test@example.com", "password": "TestPassword123!"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    return ac, headers


# ── 1. NLP Interpreter Direct Tests ──────────────────────────────────────────

def test_nlp_interpreter_variations_and_intents():
    # 1. "Tell me about employee #34"
    res1 = interpret_user_request("Tell me about employee #34")
    assert "34" in res1.employee_ids
    assert res1.active_employee_id == "34"
    assert res1.intent in (NLPIntent.EMPLOYEE_OVERVIEW, NLPIntent.EMPLOYEE_RISK)

    # 2. "Tell me about employee number #34"
    res2 = interpret_user_request("Tell me about employee number #34")
    assert "34" in res2.employee_ids
    assert res2.active_employee_id == "34"

    # 3. "employee no. 34"
    res3 = interpret_user_request("employee no. 34")
    assert "34" in res3.employee_ids
    assert res3.active_employee_id == "34"

    # 4. "Why is employee 34 high risk?"
    res4 = interpret_user_request("Why is employee 34 high risk?")
    assert res4.active_employee_id == "34"
    assert res4.intent in (NLPIntent.EMPLOYEE_RISK, NLPIntent.RISK_FACTORS)

    # 5. "What are the top contributing factors?" (Follow-up with history)
    history_34 = [{"role": "user", "content": "Tell me about employee #34"}]
    res5 = interpret_user_request("What are the top contributing factors?", conversation_history=history_34)
    assert res5.active_employee_id == "34"
    assert res5.is_follow_up is True
    assert res5.intent == NLPIntent.RISK_FACTORS

    # 6. "What should HR do?" (Follow-up with history)
    res6 = interpret_user_request("What should HR do?", conversation_history=history_34)
    assert res6.active_employee_id == "34"
    assert res6.is_follow_up is True
    assert res6.intent == NLPIntent.RETENTION_RECOMMENDATION

    # 7. "Compare employee #12 and employee #34"
    res7 = interpret_user_request("Compare employee #12 and employee #34")
    assert "12" in res7.employee_ids
    assert "34" in res7.employee_ids
    assert res7.intent == NLPIntent.EMPLOYEE_COMPARISON

    # 8. "What is SHAP?"
    res8 = interpret_user_request("What is SHAP?")
    assert res8.intent == NLPIntent.SHAP_EXPLANATION
    assert res8.active_employee_id is None

    # 9. "How can HR reduce attrition?"
    res9 = interpret_user_request("How can HR reduce attrition?")
    assert res9.intent in (NLPIntent.GENERAL_HR, NLPIntent.RETENTION_RECOMMENDATION)
    assert res9.active_employee_id is None

    # 10. Follow-up after employee #34 ("Why is the risk so high?")
    res10 = interpret_user_request("Why is the risk so high?", conversation_history=history_34)
    assert res10.active_employee_id == "34"
    assert res10.is_follow_up is True

    # 11. Employee #34 → employee #21 context switch
    res11 = interpret_user_request("Now tell me about employee #21", conversation_history=history_34)
    assert res11.active_employee_id == "21"
    assert "21" in res11.employee_ids

    # 14. General HR question with unrelated numbers ("I have 10 years of experience")
    res14 = interpret_user_request("I have 10 years of experience and salary is 50000")
    assert res14.active_employee_id is None
    assert res14.intent == NLPIntent.GENERAL_HR


# ── 2. Full API Endpoint Integration Tests ────────────────────────────────────

@pytest.mark.asyncio
async def test_ai_chat_employee_34_full_flow():
    ac, headers = await get_authenticated_client()
    emp_num = 77734
    try:
        emp_id = str(uuid.uuid4())
        pred_id = str(uuid.uuid4())
        exp_id = str(uuid.uuid4())
        async with AsyncSessionLocal() as db:
            emp = Employee(
                id=emp_id,
                employee_number=emp_num,
                feature_snapshot={
                    "Age": 40,
                    "Department": "Research & Development",
                    "JobRole": "Senior Developer",
                    "MonthlyIncome": 8500,
                    "OverTime": "Yes",
                    "JobSatisfaction": 1,
                },
            )
            db.add(emp)
            await db.flush()

            pred = Prediction(
                id=pred_id,
                employee_id=emp.id,
                employee_number=emp_num,
                attrition_probability=0.857,
                risk_level="HIGH",
                model_version="v1",
                input_features=emp.feature_snapshot,
            )
            db.add(pred)
            await db.flush()

            exp = PredictionExplanation(
                id=exp_id,
                prediction_id=pred.id,
                top_risk_factors=[
                    {"feature": "OverTime", "display_name": "Overtime Worked", "shap_value": 0.42, "display_value": "Yes"},
                    {"feature": "JobSatisfaction", "display_name": "Job Satisfaction", "shap_value": 0.28, "display_value": "1/4"},
                ],
                top_protective_factors=[
                    {"feature": "MonthlyIncome", "display_name": "Monthly Income", "shap_value": -0.15, "display_value": "$8,500"}
                ],
                base_value=0.15,
            )
            db.add(exp)
            await db.commit()

        with patch("app.api.ai.get_ai_response", new_callable=AsyncMock) as mock_get_ai:
            mock_get_ai.return_value = ("Employee 77734 is at HIGH risk (85.7%).", "gemini-1.5-flash")
            response = await ac.post(
                "/ai/chat",
                json={"message": f"Why is employee #{emp_num} high risk?"},
                headers=headers,
            )

            assert response.status_code == 200
            assert response.json()["reply"] == "Employee 77734 is at HIGH risk (85.7%)."
            mock_get_ai.assert_called_once()
            call_kwargs = mock_get_ai.call_args.kwargs
            emp_ctx = call_kwargs["employee_context"]
            pred_ctx = call_kwargs["prediction_context"]

            assert emp_ctx is not None
            assert emp_ctx.employee_number == emp_num
            assert emp_ctx.age == 40
            assert emp_ctx.overtime == "Yes"

            assert pred_ctx is not None
            assert pred_ctx.attrition_probability == 0.857
            assert pred_ctx.risk_level == "HIGH"
            assert len(pred_ctx.top_risk_factors) == 2
    finally:
        await ac.aclose()


@pytest.mark.asyncio
async def test_ai_chat_employee_comparison():
    ac, headers = await get_authenticated_client()
    emp_num1 = 77712
    emp_num2 = 77734
    try:
        async with AsyncSessionLocal() as db:
            emp1 = Employee(id=str(uuid.uuid4()), employee_number=emp_num1, feature_snapshot={"Age": 30, "Department": "Sales"})
            emp2 = Employee(id=str(uuid.uuid4()), employee_number=emp_num2, feature_snapshot={"Age": 45, "Department": "IT"})
            db.add_all([emp1, emp2])
            await db.commit()

        with patch("app.api.ai.get_ai_response", new_callable=AsyncMock) as mock_get_ai:
            mock_get_ai.return_value = ("Comparison of employee 77712 and 77734.", "gemini-1.5-flash")
            response = await ac.post(
                "/ai/chat",
                json={"message": f"Compare employee #{emp_num1} and employee #{emp_num2}"},
                headers=headers,
            )
            assert response.status_code == 200
            mock_get_ai.assert_called_once()
            call_kwargs = mock_get_ai.call_args.kwargs
            assert "EMPLOYEE COMPARISON ANALYSIS" in call_kwargs["custom_context_override"]
    finally:
        await ac.aclose()


@pytest.mark.asyncio
async def test_ai_chat_employee_not_found():
    ac, headers = await get_authenticated_client()
    try:
        response = await ac.post(
            "/ai/chat",
            json={"message": "Why is Employee 9999999 at high attrition risk?"},
            headers=headers,
        )
        assert response.status_code == 200
        assert "Employee #9999999 was not found in the available dataset." in response.json()["reply"]
    finally:
        await ac.aclose()


@pytest.mark.asyncio
async def test_ai_chat_employee_without_prediction():
    ac, headers = await get_authenticated_client()
    emp_num = 77742
    try:
        async with AsyncSessionLocal() as db:
            emp = Employee(id=str(uuid.uuid4()), employee_number=emp_num, feature_snapshot={"Age": 29, "Department": "Sales"})
            db.add(emp)
            await db.commit()

        with patch("app.api.ai.get_ai_response", new_callable=AsyncMock) as mock_get_ai:
            mock_get_ai.return_value = ("Profile loaded without prediction.", "gemini-1.5-flash")
            response = await ac.post(
                "/ai/chat",
                json={"message": f"Tell me about Employee #{emp_num}"},
                headers=headers,
            )
            assert response.status_code == 200
            mock_get_ai.assert_called_once()
            call_kwargs = mock_get_ai.call_args.kwargs
            assert call_kwargs["employee_context"].employee_number == emp_num
            assert call_kwargs["prediction_context"] is None
    finally:
        await ac.aclose()


@pytest.mark.asyncio
async def test_ai_chat_general_hr_question():
    ac, headers = await get_authenticated_client()
    try:
        with patch("app.api.ai.get_ai_response", new_callable=AsyncMock) as mock_get_ai:
            mock_get_ai.return_value = ("General HR retention insights text.", "gemini-1.5-flash")
            response = await ac.post(
                "/ai/chat",
                json={"message": "What factors generally increase employee attrition?"},
                headers=headers,
            )
            assert response.status_code == 200
            mock_get_ai.assert_called_once()
            call_kwargs = mock_get_ai.call_args.kwargs
            assert call_kwargs["employee_context"] is None
            assert call_kwargs["prediction_context"] is None
    finally:
        await ac.aclose()
