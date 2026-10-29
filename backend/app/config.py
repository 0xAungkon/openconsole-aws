from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, loaded from environment / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Database. SQLite for dev; set DATABASE_URL to a Postgres URL for prod.
    database_url: str = "sqlite:///./dev.db"

    # Auth (register mode)
    jwt_secret: str = "change-me-in-prod"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12

    # Fernet key for encrypting stored AWS credentials at rest.
    # Generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    encryption_key: str = ""

    # CORS: comma-separated list of allowed frontend origins.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Embedded frontend. Empty paths resolve to the in-repo defaults
    # (<repo>/frontend and <repo>/backend/frontend_dist).
    frontend_src: str = ""
    frontend_dist: str = ""
    auto_build_frontend: bool = True
    frontend_build_timeout: int = 600

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
