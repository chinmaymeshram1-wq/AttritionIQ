import uuid
from typing import Optional, List
from sqlalchemy import String, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.database.base import Base


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="READY", nullable=False)  # READY | PROCESSING | FAILED
    employee_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    organization_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("organizations.id"), nullable=True, index=True
    )
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    employees: Mapped[List["Employee"]] = relationship(
        "Employee", back_populates="dataset", cascade="all, delete-orphan"
    )
    predictions: Mapped[List["Prediction"]] = relationship(
        "Prediction", back_populates="dataset", cascade="all, delete-orphan"
    )
