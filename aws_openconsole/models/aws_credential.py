from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from aws_openconsole.database import Base


class AwsCredential(Base):
    """A stored AWS profile for a registered user.

    Secret material (secret access key, session token) is encrypted at rest;
    only the access key id and non-secret metadata are stored in the clear.
    """

    __tablename__ = "aws_credentials"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    label: Mapped[str] = mapped_column(String(120))
    access_key_id: Mapped[str] = mapped_column(String(128))
    secret_access_key_enc: Mapped[str] = mapped_column(String(1024))
    session_token_enc: Mapped[str | None] = mapped_column(String(4096), nullable=True)
    default_region: Mapped[str] = mapped_column(String(64), default="us-east-1")
    endpoint_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="credentials")


from aws_openconsole.models.user import User  # noqa: E402
