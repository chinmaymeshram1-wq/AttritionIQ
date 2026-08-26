from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "Employee Attrition Risk Intelligence System"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    DATABASE_URL: str = "sqlite+aiosqlite:///./attrition.db"
    MODEL_VERSION: str = "v1"
    MODEL_ARTIFACT_PATH: str = "app/ml/artifacts/model_v1.pkl"
    FEATURE_NAMES_PATH: str = "app/ml/artifacts/feature_names.json"
    LOW_THRESHOLD: float = 0.30
    HIGH_THRESHOLD: float = 0.60
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,https://attritioniq.onrender.com"
    TEST_USER_EMAIL: str = "chinmay.test@example.com"
    TEST_USER_PASSWORD: str = "TestPassword123!"

    @property
    def allowed_origins_list(self) -> List[str]:
        origins = [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]
        defaults = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "https://attritioniq.onrender.com",
        ]
        for d in defaults:
            if d not in origins:
                origins.append(d)
        return origins

    def get_risk_level(self, probability: float) -> str:
        """Convert probability to risk level using configurable thresholds."""
        if probability < self.LOW_THRESHOLD:
            return "LOW"
        elif probability < self.HIGH_THRESHOLD:
            return "MEDIUM"
        return "HIGH"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
