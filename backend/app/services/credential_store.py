from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from app.models.aws_credential import AwsCredential
from app.schemas.proxy import InlineCredentials
from app.utils import crypto


def list_credentials(db: DbSession, user_id: int) -> list[AwsCredential]:
    return list(
        db.scalars(
            select(AwsCredential).where(AwsCredential.user_id == user_id)
        ).all()
    )


def create_credential(
    db: DbSession,
    user_id: int,
    *,
    label: str,
    access_key_id: str,
    secret_access_key: str,
    session_token: str | None,
    default_region: str,
    endpoint_url: str | None,
) -> AwsCredential:
    cred = AwsCredential(
        user_id=user_id,
        label=label,
        access_key_id=access_key_id,
        secret_access_key_enc=crypto.encrypt(secret_access_key),
        session_token_enc=crypto.encrypt(session_token) if session_token else None,
        default_region=default_region,
        endpoint_url=endpoint_url,
    )
    db.add(cred)
    db.commit()
    db.refresh(cred)
    return cred


def get_credential(db: DbSession, user_id: int, cred_id: int) -> AwsCredential:
    cred = db.get(AwsCredential, cred_id)
    if cred is None or cred.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found"
        )
    return cred


def delete_credential(db: DbSession, user_id: int, cred_id: int) -> None:
    cred = get_credential(db, user_id, cred_id)
    db.delete(cred)
    db.commit()


def resolve_inline_credentials(cred: AwsCredential) -> InlineCredentials:
    """Decrypt a stored profile into transient credentials for a boto3 client."""
    return InlineCredentials(
        access_key_id=cred.access_key_id,
        secret_access_key=crypto.decrypt(cred.secret_access_key_enc),
        session_token=(
            crypto.decrypt(cred.session_token_enc) if cred.session_token_enc else None
        ),
    )
