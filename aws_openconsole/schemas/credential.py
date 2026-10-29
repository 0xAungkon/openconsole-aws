from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CredentialIn(BaseModel):
    """Create a stored AWS profile. Secret fields are write-only."""

    label: str = Field(min_length=1, max_length=120)
    access_key_id: str = Field(min_length=1, max_length=128)
    secret_access_key: str = Field(min_length=1, max_length=512)
    session_token: str | None = None
    default_region: str = "us-east-1"
    endpoint_url: str | None = None


class CredentialOut(BaseModel):
    """Public view of a stored profile — secret material is never returned."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str
    access_key_id: str
    default_region: str
    endpoint_url: str | None
    created_at: datetime
