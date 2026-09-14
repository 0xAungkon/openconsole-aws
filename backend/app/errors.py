"""Global exception handlers so infrastructure failures surface as clear
JSON errors instead of opaque 500s."""

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError, ProgrammingError, SQLAlchemyError

logger = logging.getLogger(__name__)

_MISSING_SCHEMA_MARKERS = ("no such table", "does not exist", "doesn't exist")


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
