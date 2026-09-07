from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DbSession

from app.database import get_db
from app.models.user import User
from app.schemas.credential import CredentialIn, CredentialOut
from app.services import credential_store
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/credentials", tags=["credentials"])


@router.get("", response_model=list[CredentialOut])
def list_my_credentials(
    user: User = Depends(get_current_user), db: DbSession = Depends(get_db)
) -> list[CredentialOut]:
    creds = credential_store.list_credentials(db, user.id)
    return [CredentialOut.model_validate(c) for c in creds]


@router.post("", response_model=CredentialOut, status_code=201)
def add_credential(
    data: CredentialIn,
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> CredentialOut:
    cred = credential_store.create_credential(
        db,
        user.id,
        label=data.label,
        access_key_id=data.access_key_id,
        secret_access_key=data.secret_access_key,
        session_token=data.session_token,
        default_region=data.default_region,
        endpoint_url=data.endpoint_url,
    )
    return CredentialOut.model_validate(cred)


@router.delete("/{cred_id}", status_code=204)
def remove_credential(
    cred_id: int,
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> None:
    credential_store.delete_credential(db, user.id, cred_id)
