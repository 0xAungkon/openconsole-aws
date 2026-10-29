from fastapi import HTTPException, status
from sqlalchemy.orm import Session as DbSession

from aws_openconsole.schemas.proxy import InlineCredentials
from aws_openconsole.services import credential_store
from aws_openconsole.utils.security import get_current_user


def resolve_credentials(
    *,
    credentials: InlineCredentials | None,
    profile_id: int | None,
    endpoint_url: str | None,
    token: str | None,
    db: DbSession,
) -> tuple[InlineCredentials, str | None]:
    """Resolve the effective credentials + endpoint for a request.

    Guest mode: inline credentials are supplied on the request body and used
    transiently (never persisted or logged). Register mode: a Bearer token plus
    a ``profile_id`` resolving stored, encrypted credentials owned by the
    authenticated user. Shared by the proxy and CLI routes.
    """
    if credentials is not None:
        return credentials, endpoint_url

    if profile_id is not None:
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required to use a stored profile",
            )
        user = get_current_user(token=token, db=db)
        cred = credential_store.get_credential(db, user.id, profile_id)
        creds = credential_store.resolve_inline_credentials(cred)
        # An explicit endpoint on the request overrides the profile default.
        return creds, endpoint_url or cred.endpoint_url

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Provide either inline `credentials` (guest) or a `profile_id` (register)",
    )
