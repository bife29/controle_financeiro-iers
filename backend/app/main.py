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

# Import routers
from .modules.auth.routes import router as auth_router
from .modules.members.routes import router as members_router
from .modules.financial.routes import router as financial_router
from .modules.feedback.routes import router as feedback_router
from .modules.retreat.routes import router as retreat_router


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS
    origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",")]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins if not settings.DEBUG else ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routers
    app.include_router(auth_router)
    app.include_router(members_router)
    app.include_router(financial_router)
    app.include_router(feedback_router)
    app.include_router(retreat_router)

    @app.on_event("startup")
    async def startup():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    @app.get("/health")
    def health_check():
        return {"status": "ok", "version": settings.APP_VERSION}

    return app


app = create_app()
