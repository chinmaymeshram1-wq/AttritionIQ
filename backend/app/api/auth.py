from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.session import get_db
from app.models.user import User
from app.models.organization import Organization
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    ForgotPasswordRequest,
    OnboardingRequest,
    TokenResponse,
)
from app.auth.security import hash_password, verify_password, create_access_token
from app.auth.dependencies import get_current_active_user
import uuid

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check duplicate email (case-insensitive)
    normalized_email = payload.email.strip().lower()
    result = await db.execute(select(User).where(User.email == normalized_email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    org = Organization(id=str(uuid.uuid4()), name=payload.organization_name.strip())
    db.add(org)
    await db.flush()

    user = User(
        id=str(uuid.uuid4()),
        full_name=payload.full_name.strip(),
        email=normalized_email,
        hashed_password=hash_password(payload.password),
        organization_id=org.id,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": user.id})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        full_name=user.full_name,
        email=user.email,
        organization_id=org.id,
        organization_name=org.name,
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    content_type = request.headers.get("content-type", "")
    email = None
    password = None

    if "application/json" in content_type:
        try:
            body = await request.json()
            email = body.get("email") or body.get("username")
            password = body.get("password")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid JSON payload",
            )
    else:
        # Form data (x-www-form-urlencoded or multipart/form-data)
        try:
            form = await request.form()
            email = form.get("username") or form.get("email")
            password = form.get("password")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid form data",
            )

    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Email/username and password are required",
        )

    normalized_email = str(email).strip().lower()

    result = await db.execute(select(User).where(User.email == normalized_email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(str(password), user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive. Please contact support.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    org_name = None
    if user.organization_id:
        org_result = await db.execute(
            select(Organization).where(Organization.id == user.organization_id)
        )
        org = org_result.scalar_one_or_none()
        org_name = org.name if org else None

    token = create_access_token({"sub": user.id})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        full_name=user.full_name,
        email=user.email,
        organization_id=user.organization_id,
        organization_name=org_name,
    )


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest):
    # Email integration placeholder
    return {"message": "If that email is registered, a reset link will be sent."}


@router.post("/onboarding")
async def complete_onboarding(
    payload: OnboardingRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.organization_id:
        result = await db.execute(
            select(Organization).where(Organization.id == current_user.organization_id)
        )
        org = result.scalar_one_or_none()
        if org:
            org.name = payload.organization_name
            org.industry = payload.industry
            org.employee_count_approx = payload.employee_count_approx
            await db.commit()
            return {"message": "Organization updated", "organization_id": org.id}
    raise HTTPException(status_code=404, detail="Organization not found")
