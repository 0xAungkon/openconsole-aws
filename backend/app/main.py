import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.errors import register_exception_handlers
from app.routes import auth, cli, credentials, history, proxy

logger = logging.getLogger(__name__)

app = FastAPI(title="AWS OpenConsole API", version="0.1.0")
register_exception_handlers(app)

if not settings.encryption_key or settings.encryption_key == "change-me":
    logger.warning(
        "ENCRYPTION_KEY is not set — saving AWS profiles (register mode) will fail "
        "until backend/.env defines one. See backend/.env.example."
    )
if settings.jwt_secret in ("change-me", "change-me-in-prod"):
    logger.warning("JWT_SECRET is using the insecure default — set it in backend/.env.")

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
