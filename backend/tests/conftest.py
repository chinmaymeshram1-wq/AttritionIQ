import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.database.session import engine, AsyncSessionLocal
from app.database.base import Base
from app.database.seed import seed_initial_data
from app.main import app as fastapi_app
from sqlalchemy import text
import app.models  # noqa: F401


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_database():
    """Ensure database schema has all current tables and columns before running test suite."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        try:
            res_emp = await conn.execute(text("PRAGMA table_info(employees)"))
            emp_cols = [row[1] for row in res_emp.fetchall()]
            if emp_cols and "dataset_id" not in emp_cols:
                await conn.execute(text("ALTER TABLE employees ADD COLUMN dataset_id VARCHAR(36)"))

            res_pred = await conn.execute(text("PRAGMA table_info(predictions)"))
            pred_cols = [row[1] for row in res_pred.fetchall()]
            if pred_cols and "dataset_id" not in pred_cols:
                await conn.execute(text("ALTER TABLE predictions ADD COLUMN dataset_id VARCHAR(36)"))
            if pred_cols and "is_standalone" not in pred_cols:
                await conn.execute(text("ALTER TABLE predictions ADD COLUMN is_standalone BOOLEAN DEFAULT 0"))
        except Exception:
            pass
    yield


@pytest_asyncio.fixture
async def db_session():
    async with AsyncSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client():
    async with AsyncSessionLocal() as session:
        await seed_initial_data(session)
    ac = AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test")
    yield ac
    await ac.aclose()


@pytest_asyncio.fixture
async def test_user(client):
    login_res = await client.post(
        "/auth/login",
        json={"email": "chinmay.test@example.com", "password": "TestPassword123!"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    return {"email": "chinmay.test@example.com", "token": token}
