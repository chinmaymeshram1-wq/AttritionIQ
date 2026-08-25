from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.utils.config import settings
from app.database.session import engine
from app.database.base import Base
import app.models  # noqa: F401 — ensures all models are registered for metadata


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create DB tables on startup. In production use Alembic migrations."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Production-grade HR SaaS — ML-powered attrition risk prediction",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API Routers ────────────────────────────────────────────────────────────────
from app.api.auth import router as auth_router
from app.api.prediction import router as prediction_router
from app.api.employees import router as employees_router
from app.api.analytics import router as analytics_router
from app.api.ai import router as ai_router
from app.api.whatif import router as whatif_router
from app.api.dashboard import router as dashboard_router

app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(prediction_router, prefix="/prediction", tags=["Prediction"])
app.include_router(employees_router, prefix="/employees", tags=["Employees"])
app.include_router(analytics_router, prefix="/analytics", tags=["Analytics"])
app.include_router(ai_router, prefix="/ai", tags=["AI Assistant"])
app.include_router(whatif_router, prefix="/what-if", tags=["What-If"])
app.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])


@app.get("/health", tags=["Health"])
async def health_check():
    return JSONResponse({"status": "ok", "version": "1.0.0", "model_version": settings.MODEL_VERSION})
