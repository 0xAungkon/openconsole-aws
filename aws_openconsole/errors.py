"""Global exception handlers so infrastructure failures surface as clear
JSON errors instead of opaque 500s."""

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError, ProgrammingError, SQLAlchemyError

from aws_openconsole.config import settings

logger = logging.getLogger(__name__)


def _cors_headers(request: Request) -> dict[str, str]:
    """Handlers for ``Exception`` run outside CORSMiddleware, so a 500 would
    reach the browser without CORS headers and look like a network failure."""
    origin = request.headers.get("origin")
    if origin and origin in settings.cors_origin_list:
        return {"Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true"}
    return {}

_MISSING_SCHEMA_MARKERS = ("no such table", "does not exist", "doesn't exist")


class ConfigurationError(RuntimeError):
    """The server is missing or has invalid configuration (e.g. ENCRYPTION_KEY)."""


def _db_detail(exc: SQLAlchemyError) -> str:
    message = str(getattr(exc, "orig", exc))
    if isinstance(exc, (OperationalError, ProgrammingError)) and any(
        marker in message for marker in _MISSING_SCHEMA_MARKERS
    ):
        return (
            "Database schema is not set up. Run `uv run alembic upgrade head` "
            f"in the backend directory. ({message})"
        )
    if isinstance(exc, OperationalError):
        return f"Database is unavailable: {message}"
    return f"Database error: {message}"


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(ConfigurationError)
    async def _handle_config_error(request: Request, exc: ConfigurationError) -> JSONResponse:
        logger.error("Configuration error on %s %s: %s", request.method, request.url.path, exc)
        return JSONResponse(
            status_code=503,
            content={"detail": str(exc), "code": "ConfigurationError"},
        )

    @app.exception_handler(Exception)
    async def _handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        # Last resort: never return a bare "Internal Server Error" — the UI shows
        # `detail`, so include the exception type and message.
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={
                "detail": f"{type(exc).__name__}: {exc}" if str(exc) else type(exc).__name__,
                "code": "InternalError",
            },
            headers=_cors_headers(request),
        )

    @app.exception_handler(SQLAlchemyError)
    async def _handle_db_error(request: Request, exc: SQLAlchemyError) -> JSONResponse:
        detail = _db_detail(exc)
        logger.error(
            "Database error on %s %s: %s", request.method, request.url.path, detail
        )
        return JSONResponse(
            status_code=503,
            content={"detail": detail, "code": "DatabaseError"},
        )
