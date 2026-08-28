from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class DatasetBase(BaseModel):
    name: str
    original_filename: str


class DatasetCreate(DatasetBase):
    pass


class DatasetResponse(BaseModel):
    id: str
    dataset_number: int
    name: str
    original_filename: str
    status: str
    employee_count: int
    organization_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DatasetListResponse(BaseModel):
    datasets: List[DatasetResponse]
    max_allowed: int = 7
