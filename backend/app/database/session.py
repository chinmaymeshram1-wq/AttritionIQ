from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.utils.config import settings

# Engine configured via DATABASE_URL — swap sqlite -> postgresql+asyncpg:// without touching this file
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def get_db() -> AsyncSession:  # type: ignore
    """FastAPI dependency that yields a database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
