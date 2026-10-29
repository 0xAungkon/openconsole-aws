import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from aws_openconsole.config import settings
from aws_openconsole.errors import register_exception_handlers
from aws_openconsole.routes import auth, cli, credentials, history, proxy
from aws_openconsole.services.frontend import build_frontend, register_frontend

logger = logging.getLogger(__name__)

# The app configures no logging, so uvicorn leaves the root logger at WARNING and
# `logger.info(...)` is invisible — yet the frontend build takes seconds and must
# be seen. Give the package its own INFO handler; third-party loggers
# (sqlalchemy, httpx, boto3) still inherit WARNING from root and stay quiet.
_app_log = logging.getLogger("aws_openconsole")
if not _app_log.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(levelname)s %(name)s: %(message)s"))
    _app_log.addHandler(_handler)
    _app_log.setLevel(logging.INFO)
    _app_log.propagate = False

app = FastAPI(title="AWS OpenConsole API", version="0.1.0")
register_exception_handlers(app)

if not settings.encryption_key or settings.encryption_key == "change-me":
    logger.warning(
        "ENCRYPTION_KEY is not set — saving AWS profiles (register mode) will fail "
        "until .env defines one. See .env.example."
    )
if settings.jwt_secret in ("change-me", "change-me-in-prod"):
    logger.warning("JWT_SECRET is using the insecure default — set it in .env.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(credentials.router)
app.include_router(proxy.router)
app.include_router(cli.router)
app.include_router(history.router)


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


# The SPA catch-all must be registered last so it never shadows an API route.
# Build first: register_frontend() needs the output directory to exist.
if settings.auto_build_frontend:
    build_frontend()
register_frontend(app)
