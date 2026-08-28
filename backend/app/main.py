import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.utils.config import settings
from app.database.session import engine
from app.database.base import Base
import app.models  # noqa: F401 — ensures all models are registered for metadata

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("attritioniq")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create DB tables and seed initial test data on startup."""
    print("[AUTH] Starting database initialization...", flush=True)
    logger.info("[AUTH] Starting database initialization...")

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            # Safe column migration for existing SQLite databases
            from sqlalchemy import text
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
            except Exception as mig_err:
                logger.warning(f"[DB] Migration check: {mig_err}")

        print("[AUTH] Database initialized", flush=True)
        logger.info("[AUTH] Database initialized")
    except Exception as e:
        print(f"[AUTH] Error creating database tables: {e}", flush=True)
        logger.error(f"[AUTH] Error creating database tables: {e}", exc_info=True)
        raise

    # Seed / verify initial test data (user and default organization)
    try:
        from app.database.session import AsyncSessionLocal
        from app.database.seed import seed_initial_data
        async with AsyncSessionLocal() as session:
            await seed_initial_data(session)
    except Exception as e:
        print(f"[AUTH] Failed to initialize demo user: {e}", flush=True)
        logger.error(f"[AUTH] Failed to initialize demo user: {e}", exc_info=True)
        raise

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
from app.api.datasets import router as datasets_router

app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(prediction_router, prefix="/prediction", tags=["Prediction"])
app.include_router(employees_router, prefix="/employees", tags=["Employees"])
app.include_router(analytics_router, prefix="/analytics", tags=["Analytics"])
app.include_router(ai_router, prefix="/ai", tags=["AI Assistant"])
app.include_router(whatif_router, prefix="/what-if", tags=["What-If"])
app.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])
app.include_router(datasets_router, prefix="/datasets", tags=["Dataset Manager"])


@app.get("/health", tags=["Health"])
async def health_check():
    return JSONResponse({"status": "ok", "version": "1.0.0", "model_version": settings.MODEL_VERSION})
