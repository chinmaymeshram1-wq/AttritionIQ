from sqlalchemy import String, Float, DateTime, ForeignKey, JSON, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.database.base import Base
from typing import Optional
import uuid


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id: Mapped[str] = mapped_column(String(36), ForeignKey("employees.id"), nullable=False)
    employee_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    attrition_probability: Mapped[float] = mapped_column(Float, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(10), nullable=False)  # LOW | MEDIUM | HIGH
    model_version: Mapped[str] = mapped_column(String(20), nullable=False)
    input_features: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    employee: Mapped["Employee"] = relationship("Employee", back_populates="predictions")
    explanation: Mapped[Optional["PredictionExplanation"]] = relationship(
        "PredictionExplanation", back_populates="prediction", uselist=False
    )
