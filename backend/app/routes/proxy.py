from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session as DbSession

from app.database import get_db
from app.schemas.proxy import InlineCredentials, ProxyRequest, ProxyResponse
from app.services import aws_proxy, credential_store
from app.utils.security import get_current_user, oauth2_scheme

router = APIRouter(prefix="/api", tags=["proxy"])


def _resolve_credentials(
    req: ProxyRequest, token: str | None, db: DbSession
) -> tuple[InlineCredentials, str | None]:
    """Return (credentials, endpoint_url) for the request.

    Guest mode: inline credentials on the request body.
    Register mode: a Bearer token plus a profile_id resolving stored, encrypted
    credentials owned by the authenticated user.
    """
    if req.credentials is not None:
        return req.credentials, req.endpoint_url

    if req.profile_id is not None:
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required to use a stored profile",
            )
        user = get_current_user(token=token, db=db)
        cred = credential_store.get_credential(db, user.id, req.profile_id)
        creds = credential_store.resolve_inline_credentials(cred)
        # An explicit endpoint on the request overrides the profile default.
        return creds, req.endpoint_url or cred.endpoint_url

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Provide either inline `credentials` (guest) or a `profile_id` (register)",
    )


@router.post("/proxy", response_model=ProxyResponse)
def proxy(
    req: ProxyRequest,
    token: str | None = Depends(oauth2_scheme),
    db: DbSession = Depends(get_db),
) -> JSONResponse:
    credentials, endpoint_url = _resolve_credentials(req, token, db)

    try:
        result = aws_proxy.run_query(
            service=req.service,
            operation=req.operation,
            region=req.region,
            params=req.params,
            endpoint_url=endpoint_url,
            credentials=credentials,
        )
    except aws_proxy.ProxyExecutionError as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content=ProxyResponse(ok=False, error=exc.error).model_dump(),
        )

    return JSONResponse(
        content=ProxyResponse(ok=True, result=result).model_dump()
    )
