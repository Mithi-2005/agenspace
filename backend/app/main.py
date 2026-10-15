import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.api.routes.auth import router as auth_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.events import router as events_router
from app.api.routes.health import router as health_router
from app.api.routes.plugins import router as plugins_router
from app.api.routes.tasks import router as tasks_router
from app.api.routes.users import router as users_router
from app.core.config import get_settings

logger = logging.getLogger("kosway.api")

settings = get_settings()
logging.basicConfig(level=settings.log_level)

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description=f"{settings.app_name} API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID", "Origin", "Accept"],
)

app.include_router(health_router, prefix=settings.api_v1_prefix, tags=["health"])
app.include_router(auth_router, prefix=f"{settings.api_v1_prefix}/auth", tags=["auth"])
app.include_router(users_router, prefix=f"{settings.api_v1_prefix}/users", tags=["users"])
app.include_router(tasks_router, prefix=f"{settings.api_v1_prefix}/tasks", tags=["tasks"])
app.include_router(events_router, prefix=f"{settings.api_v1_prefix}/events", tags=["events"])
app.include_router(dashboard_router, prefix=f"{settings.api_v1_prefix}/dashboard", tags=["dashboard"])
app.include_router(plugins_router, prefix=f"{settings.api_v1_prefix}/plugins", tags=["plugins"])


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    logger.error("Database operation failed: %s", type(exc).__name__)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "A database error occurred. Please try again later."},
    )


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:
    return {"name": settings.app_name, "status": "running"}
