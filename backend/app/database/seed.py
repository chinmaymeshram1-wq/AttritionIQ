import uuid
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.organization import Organization
from app.auth.security import hash_password, verify_password
from app.utils.config import settings

logger = logging.getLogger("attritioniq")


async def seed_initial_data(db: AsyncSession) -> None:
    """
    Ensure the test user and default organization exist in the database.
    Runs on application startup so authentication works on fresh/ephemeral
    production databases.
    """
    test_email = (
        settings.TEST_USER_EMAIL or "chinmay.test@example.com"
    ).strip().lower()

    test_password = settings.TEST_USER_PASSWORD or "TestPassword123!"

    try:
        # Ensure a default organization exists
        org_result = await db.execute(
            select(Organization).limit(1)
        )
        default_org = org_result.scalar_one_or_none()

        if not default_org:
            default_org = Organization(
                id=str(uuid.uuid4()),
                name="Acme Corporation",
                industry="Technology",
                employee_count_approx=1500,
            )
            db.add(default_org)
            await db.flush()

            logger.info(
                "[AUTH] Created default organization: %s",
                default_org.name,
            )

        # Find the demo/test user
        user_result = await db.execute(
            select(User).where(User.email == test_email)
        )
        user = user_result.scalar_one_or_none()

        if not user:
            user = User(
                id=str(uuid.uuid4()),
                full_name="Chinmay Test",
                email=test_email,
                hashed_password=hash_password(test_password),
                is_active=True,
                is_admin=True,
                organization_id=default_org.id,
            )

            db.add(user)
            await db.commit()

            logger.info("[AUTH] Demo user verified/created")
            logger.info(
                "[AUTH] Demo login account ready: %s",
                test_email,
            )

        else:
            # Ensure the password is correct
            if not verify_password(
                test_password,
                user.hashed_password,
            ):
                user.hashed_password = hash_password(test_password)

            user.is_active = True

            if not user.organization_id:
                user.organization_id = default_org.id

            await db.commit()

            logger.info("[AUTH] Demo user verified/created")
            logger.info(
                "[AUTH] Demo login account ready: %s",
                test_email,
            )

    except Exception as e:
        await db.rollback()

        logger.error(
            "[AUTH] Error during database seeding: %s",
            e,
            exc_info=True,
        )

        raise
