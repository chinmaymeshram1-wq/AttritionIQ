import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, desc

from app.database.session import get_db
from app.models.dataset import Dataset
from app.models.employee import Employee
from app.models.prediction import Prediction
from app.models.user import User
from app.auth.dependencies import get_current_active_user
from app.schemas.dataset import DatasetResponse, DatasetListResponse
from app.services.batch_service import BatchService

router = APIRouter()

MAX_DATASETS_PER_ORG = 7


@router.get("", response_model=DatasetListResponse)
@router.get("/", response_model=DatasetListResponse)
async def list_datasets(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List all uploaded datasets for the current user's organization (max 7)."""
    stmt = select(Dataset)
    if current_user.organization_id:
        stmt = stmt.where(Dataset.organization_id == current_user.organization_id)
    stmt = stmt.order_by(Dataset.dataset_number.asc())

    res = await db.execute(stmt)
    datasets = res.scalars().all()

    return DatasetListResponse(
        datasets=[DatasetResponse.model_validate(d) for d in datasets],
        max_allowed=MAX_DATASETS_PER_ORG,
    )


@router.post("/upload", response_model=DatasetResponse)
async def upload_dataset(
    file: UploadFile = File(...),
    custom_name: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Upload a new CSV dataset.
    Enforces maximum 7 datasets limit.
    Creates Dataset entry, imports employees, and runs batch prediction & SHAP pipeline.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    # Check current dataset count
    stmt = select(func.count(Dataset.id))
    if current_user.organization_id:
        stmt = stmt.where(Dataset.organization_id == current_user.organization_id)
    count_res = await db.execute(stmt)
    current_count = count_res.scalar() or 0

    if current_count >= MAX_DATASETS_PER_ORG:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum limit of {MAX_DATASETS_PER_ORG} datasets reached. Please delete an existing dataset before uploading a new one.",
        )

    # Determine next dataset number (1 to 7)
    existing_nums_stmt = select(Dataset.dataset_number)
    if current_user.organization_id:
        existing_nums_stmt = existing_nums_stmt.where(Dataset.organization_id == current_user.organization_id)
    num_res = await db.execute(existing_nums_stmt)
    used_numbers = set(num_res.scalars().all())

    next_num = 1
    for n in range(1, MAX_DATASETS_PER_ORG + 1):
        if n not in used_numbers:
            next_num = n
            break

    orig_filename = file.filename
    clean_name = custom_name.strip() if custom_name and custom_name.strip() else orig_filename
    display_name = f"Dataset {next_num:02d} — {clean_name}"

    dataset_id = str(uuid.uuid4())
    dataset = Dataset(
        id=dataset_id,
        dataset_number=next_num,
        name=display_name,
        original_filename=orig_filename,
        status="PROCESSING",
        employee_count=0,
        organization_id=current_user.organization_id,
    )
    db.add(dataset)
    await db.commit()
    await db.refresh(dataset)

    # Read CSV content
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        dataset.status = "FAILED"
        await db.commit()
        raise HTTPException(status_code=413, detail="File too large. Maximum 10 MB allowed.")

    try:
        batch_service = BatchService(db=db, dataset_id=dataset.id)
        batch_result = await batch_service.process_batch(content)

        if batch_result.failed > 0 and batch_result.successful == 0:
            dataset.status = "FAILED"
            await db.commit()
            error_details = batch_result.validation_errors[0].errors[0] if batch_result.validation_errors else "CSV processing failed"
            raise HTTPException(status_code=400, detail=f"Dataset processing failed: {error_details}")

        # Update dataset status and count
        dataset.status = "READY"
        dataset.employee_count = batch_result.successful
        await db.commit()
        await db.refresh(dataset)

        return DatasetResponse.model_validate(dataset)
    except HTTPException:
        raise
    except Exception as e:
        dataset.status = "FAILED"
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Dataset processing failed: {str(e)}")


@router.get("/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(
    dataset_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    stmt = select(Dataset).where(Dataset.id == dataset_id)
    if current_user.organization_id:
        stmt = stmt.where(Dataset.organization_id == current_user.organization_id)
    res = await db.execute(stmt)
    dataset = res.scalars().first()

    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    return DatasetResponse.model_validate(dataset)


@router.delete("/{dataset_id}")
async def delete_dataset(
    dataset_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    stmt = select(Dataset).where(Dataset.id == dataset_id)
    if current_user.organization_id:
        stmt = stmt.where(Dataset.organization_id == current_user.organization_id)
    res = await db.execute(stmt)
    dataset = res.scalars().first()

    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    await db.delete(dataset)
    await db.commit()

    return {"message": f"Dataset {dataset.dataset_number:02d} deleted successfully."}
