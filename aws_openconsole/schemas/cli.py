from pydantic import BaseModel, Field

from aws_openconsole.schemas.proxy import InlineCredentials


class CliRequest(BaseModel):
    """A raw AWS CLI command line typed in the in-app terminal.

    Credentials are resolved exactly like the proxy: guest supplies inline
    `credentials`; register supplies `profile_id` (+ Bearer token).
    """

    command: str = Field(min_length=1, examples=["aws s3 ls", "aws ec2 describe-instances"])
    region: str = "us-east-1"
    endpoint_url: str | None = None
    credentials: InlineCredentials | None = None
    profile_id: int | None = None


class CliResponse(BaseModel):
    ok: bool
    exit_code: int
    stdout: str = ""
    stderr: str = ""
    # The effective command actually executed (region/endpoint appended). Never
    # contains credentials — those are passed via the environment, not argv.
    command: str = ""
