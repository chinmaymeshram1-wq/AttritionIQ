from sqlalchemy import String, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.database.base import Base
from typing import Optional, List
import uuid


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    organization_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("organizations.id"), nullable=True
    )
    dataset_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("datasets.id"), nullable=True, index=True
    )
    # Raw feature snapshot stored as JSON for audit trail
    feature_snapshot: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    dataset: Mapped[Optional["Dataset"]] = relationship("Dataset", back_populates="employees")
    predictions: Mapped[List["Prediction"]] = relationship("Prediction", back_populates="employee", cascade="all, delete-orphan")
