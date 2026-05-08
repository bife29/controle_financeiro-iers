from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .core.database import engine, Base

# Import all models to register them with SQLAlchemy
from .modules.auth.models import User  # noqa
from .modules.members.models import Member  # noqa
from .modules.financial.models import Category, Project, Transaction, ParticipantEvent, AuditLog  # noqa
from .modules.feedback.models import Feedback  # noqa
from .modules.retreat.models import Retreat, RetreatParticipant, RetreatPayment  # noqa
from .modules.secretaria.models import (  # noqa
    Event, WhatsappGroup, MessageTemplate, ChurchSettings,
)
from .modules.patrimony.models import (  # noqa
    Asset, AssetCategory, AssetLocation, AssetMaintenance,
)

# Import routers
from .modules.auth.routes import router as auth_router
from .modules.members.routes import router as members_router
from .modules.financial.routes import router as financial_router
from .modules.feedback.routes import router as feedback_router
from .modules.retreat.routes import router as retreat_router
from .modules.secretaria.routes import router as secretaria_router
from .modules.patrimony.routes import router as patrimony_router
from .modules.reports.routes import router as reports_router


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS
    origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins if not settings.DEBUG else ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
        allow_origin_regex=r"https://.*\.vercel\.app" if not settings.DEBUG else None,
    )

    # Register routers
    app.include_router(auth_router)
    app.include_router(members_router)
    app.include_router(financial_router)
    app.include_router(feedback_router)
    app.include_router(retreat_router)
    app.include_router(secretaria_router)
    app.include_router(patrimony_router)
    app.include_router(reports_router)

    @app.on_event("startup")
    async def startup():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            # Migrate: add new columns if they don't exist (safe for PostgreSQL and SQLite)
            await _apply_migrations(conn)

    @app.get("/health")
    def health_check():
        return {"status": "ok", "version": settings.APP_VERSION}

    return app


async def _apply_migrations(conn):
    """Add missing columns to existing tables (safe to run multiple times)."""
    from sqlalchemy import text, inspect

    def _get_columns(connection, table_name):
        inspector = inspect(connection)
        try:
            return [c["name"] for c in inspector.get_columns(table_name)]
        except Exception:
            return []

    columns = await conn.run_sync(lambda c: _get_columns(c, "transactions"))
    if columns:  # table exists
        if "is_recurring" not in columns:
            await conn.execute(text(
                "ALTER TABLE transactions ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE"
            ))
        if "recurring_group_id" not in columns:
            await conn.execute(text(
                "ALTER TABLE transactions ADD COLUMN recurring_group_id VARCHAR(50)"
            ))
        if "bank_origin" not in columns:
            await conn.execute(text(
                "ALTER TABLE transactions ADD COLUMN bank_origin VARCHAR(100)"
            ))
        if "bank_reference" not in columns:
            await conn.execute(text(
                "ALTER TABLE transactions ADD COLUMN bank_reference VARCHAR(100)"
            ))
            try:
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS ix_transactions_bank_reference "
                    "ON transactions (bank_reference)"
                ))
            except Exception:
                pass
        if "payment_date" not in columns:
            await conn.execute(text(
                "ALTER TABLE transactions ADD COLUMN payment_date DATE"
            ))
        # Renomear status legado 'Conciliado' -> 'Confirmado' (consolidacao em 2 status)
        try:
            await conn.execute(text(
                "UPDATE transactions SET status='Confirmado' WHERE status='Conciliado'"
            ))
        except Exception:
            pass
        # Make project_id nullable. PostgreSQL supports ALTER COLUMN; SQLite
        # does not, so we use the table-rebuild dance (CREATE temp + COPY + DROP + RENAME).
        dialect_name = conn.dialect.name
        if dialect_name == "postgresql":
            try:
                await conn.execute(text(
                    "ALTER TABLE transactions ALTER COLUMN project_id DROP NOT NULL"
                ))
            except Exception:
                pass  # already nullable
        elif dialect_name == "sqlite":
            # Check current notnull state via PRAGMA
            def _project_id_notnull(connection):
                rows = connection.exec_driver_sql("PRAGMA table_info(transactions)").fetchall()
                for r in rows:
                    # (cid, name, type, notnull, default, pk)
                    if r[1] == "project_id":
                        return bool(r[3])
                return False

            needs_rebuild = await conn.run_sync(_project_id_notnull)
            if needs_rebuild:
                # Recreate transactions with project_id NULL allowed
                await conn.execute(text("PRAGMA foreign_keys=OFF"))
                await conn.execute(text("""
                    CREATE TABLE transactions__new (
                        id INTEGER NOT NULL PRIMARY KEY,
                        date DATE NOT NULL,
                        type VARCHAR(20) NOT NULL,
                        value FLOAT NOT NULL,
                        description TEXT,
                        payment_method VARCHAR(50),
                        category_id INTEGER,
                        member_id INTEGER,
                        project_id INTEGER,
                        status VARCHAR(20),
                        imported_from VARCHAR(50),
                        created_by INTEGER,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME,
                        is_recurring BOOLEAN DEFAULT FALSE,
                        recurring_group_id VARCHAR(50),
                        bank_origin VARCHAR(100)
                    )
                """))
                await conn.execute(text("""
                    INSERT INTO transactions__new
                        (id, date, type, value, description, payment_method,
                         category_id, member_id, project_id, status, imported_from,
                         created_by, created_at, updated_at, is_recurring,
                         recurring_group_id, bank_origin)
                    SELECT id, date, type, value, description, payment_method,
                           category_id, member_id, project_id, status, imported_from,
                           created_by, created_at, updated_at, is_recurring,
                           recurring_group_id, bank_origin
                    FROM transactions
                """))
                await conn.execute(text("DROP TABLE transactions"))
                await conn.execute(text("ALTER TABLE transactions__new RENAME TO transactions"))
                await conn.execute(text("PRAGMA foreign_keys=ON"))

    # Members: coluna age_group_override (override manual da faixa etária)
    member_cols = await conn.run_sync(lambda c: _get_columns(c, "members"))
    if member_cols and "age_group_override" not in member_cols:
        await conn.execute(text(
            "ALTER TABLE members ADD COLUMN age_group_override VARCHAR(30)"
        ))


app = create_app()
