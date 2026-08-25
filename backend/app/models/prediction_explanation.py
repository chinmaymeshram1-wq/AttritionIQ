from sqlalchemy import String, DateTime, ForeignKey, JSON, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.database.base import Base
from typing import Optional
import uuid


class PredictionExplanation(Base):
    __tablename__ = "prediction_explanations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    prediction_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("predictions.id"), unique=True, nullable=False
    )
    # List of {feature, shap_value, display_value} dicts sorted descending
    top_risk_factors: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    # List of {feature, shap_value, display_value} dicts sorted ascending
    top_protective_factors: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    base_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    prediction: Mapped["Prediction"] = relationship("Prediction", back_populates="explanation")
