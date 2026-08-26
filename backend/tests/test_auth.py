import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database.session import AsyncSessionLocal
from app.database.seed import seed_initial_data
from app.auth.security import decode_access_token


@pytest.mark.asyncio
async def test_auth_lifespan_and_seed():
    # Run seed
    async with AsyncSessionLocal() as session:
        await seed_initial_data(session)


@pytest.mark.asyncio
async def test_login_json_success():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Seed test user
        async with AsyncSessionLocal() as session:
            await seed_initial_data(session)

        response = await ac.post(
            "/auth/login",
            json={
                "email": "chinmay.test@example.com",
                "password": "TestPassword123!",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["email"] == "chinmay.test@example.com"
        assert data["full_name"] == "Chinmay Test"

        # Verify JWT payload
        payload = decode_access_token(data["access_token"])
        assert payload is not None
        assert payload["sub"] == data["user_id"]


@pytest.mark.asyncio
async def test_login_form_urlencoded_success():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Seed test user
        async with AsyncSessionLocal() as session:
            await seed_initial_data(session)

        response = await ac.post(
            "/auth/login",
            data={
                "username": "chinmay.test@example.com",
                "password": "TestPassword123!",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["email"] == "chinmay.test@example.com"


@pytest.mark.asyncio
async def test_login_wrong_password_returns_401():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(
            "/auth/login",
            json={
                "email": "chinmay.test@example.com",
                "password": "WrongPassword999!",
            },
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid email or password"


@pytest.mark.asyncio
async def test_login_nonexistent_user_returns_401():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(
            "/auth/login",
            json={
                "email": "does.not.exist@example.com",
                "password": "SomePassword123!",
            },
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid email or password"


@pytest.mark.asyncio
async def test_register_and_subsequent_login():
    import uuid
    unique_email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Register
        reg_response = await ac.post(
            "/auth/register",
            json={
                "full_name": "Test Suite User",
                "email": unique_email,
                "organization_name": "Integration Org",
                "password": "SuperSecretPassword123!",
                "confirm_password": "SuperSecretPassword123!",
            },
        )
        assert reg_response.status_code == 201
        reg_data = reg_response.json()
        assert reg_data["email"] == unique_email
        assert reg_data["access_token"] is not None

        # Login with newly created user
        login_response = await ac.post(
            "/auth/login",
            json={
                "email": unique_email,
                "password": "SuperSecretPassword123!",
            },
        )
        assert login_response.status_code == 200
        login_data = login_response.json()
        assert login_data["access_token"] is not None
        assert login_data["email"] == unique_email
