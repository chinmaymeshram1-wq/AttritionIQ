import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database.session import AsyncSessionLocal
from app.database.seed import seed_initial_data
from unittest.mock import patch, AsyncMock


@pytest.mark.asyncio
async def test_ai_chat_success():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Seed test user & login
        async with AsyncSessionLocal() as session:
            await seed_initial_data(session)

        login_res = await ac.post(
            "/auth/login",
            json={
                "email": "chinmay.test@example.com",
                "password": "TestPassword123!",
            },
        )
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]

        # Mock Gemini response
        mock_response = AsyncMock()
        mock_response.text = "This employee has a high attrition risk primarily due to overtime and low job satisfaction."

        with patch("google.generativeai.GenerativeModel") as mock_model_cls:
            mock_instance = mock_model_cls.return_value
            mock_instance.generate_content_async = AsyncMock(return_value=mock_response)
            mock_chat = AsyncMock()
            mock_chat.send_message_async = AsyncMock(return_value=mock_response)
            mock_instance.start_chat.return_value = mock_chat

            # Call /ai/chat
            chat_res = await ac.post(
                "/ai/chat",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "message": "Why is this employee likely to leave?",
                    "employee_context": {
                        "employee_number": 101,
                        "department": "Sales",
                        "job_role": "Sales Executive",
                    },
                    "prediction_context": {
                        "attrition_probability": 0.75,
                        "risk_level": "HIGH",
                    },
                    "conversation_history": [],
                },
            )
            assert chat_res.status_code == 200
            data = chat_res.json()
            assert "reply" in data
            assert "overtime" in data["reply"]
            assert data["model_used"] != ""
