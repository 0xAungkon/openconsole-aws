from typing import Any

from pydantic import BaseModel, Field


class InlineCredentials(BaseModel):
    """Guest-mode credentials, supplied per request and never persisted."""

    access_key_id: str
    secret_access_key: str
    session_token: str | None = None


class ProxyRequest(BaseModel):
    """A raw AWS query issued by the frontend in either mode.

    Guest mode supplies `credentials` inline. Register mode omits `credentials`
    and instead supplies `profile_id` (and a Bearer token) so the backend can
    resolve stored, encrypted credentials.
    """

    service: str = Field(min_length=1, examples=["s3", "ec2", "lambda"])
    operation: str = Field(min_length=1, examples=["list_buckets", "describe_instances"])
    region: str = "us-east-1"
    params: dict[str, Any] = Field(default_factory=dict)
    endpoint_url: str | None = None
    credentials: InlineCredentials | None = None
    profile_id: int | None = None


class ProxyError(BaseModel):
    code: str
    message: str


class ProxyResponse(BaseModel):
    ok: bool
    result: Any | None = None
    error: ProxyError | None = None
