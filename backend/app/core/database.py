import ssl as ssl_module

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from .config import settings, BASE_DIR


# Suporta tanto PostgreSQL (produção) quanto SQLite (dev local)
db_url = settings.DATABASE_URL
if db_url.startswith("sqlite"):
    # Resolve relative paths against backend dir
    db_url = db_url.replace("///./", f"///{BASE_DIR}/")
    engine = create_async_engine(db_url, echo=settings.DEBUG)
else:
    # asyncpg não aceita sslmode na URL; converter para connect_args
    connect_args = {}
    if "sslmode=" in db_url:
        db_url = db_url.replace("?sslmode=require", "").replace("&sslmode=require", "")
        connect_args["ssl"] = ssl_module.create_default_context()
    engine = create_async_engine(db_url, echo=settings.DEBUG, connect_args=connect_args)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
