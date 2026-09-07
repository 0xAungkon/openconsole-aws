from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session as DbSession

from app.database import get_db
from app.schemas.proxy import ProxyRequest, ProxyResponse
from app.services import aws_proxy
from app.services.request_auth import resolve_credentials
from app.utils.security import oauth2_scheme

router = APIRouter(prefix="/api", tags=["proxy"])


@router.post("/proxy", response_model=ProxyResponse)
def proxy(
    req: ProxyRequest,
    token: str | None = Depends(oauth2_scheme),
    db: DbSession = Depends(get_db),
) -> JSONResponse:
    credentials, endpoint_url = resolve_credentials(
        credentials=req.credentials,
        profile_id=req.profile_id,
        endpoint_url=req.endpoint_url,
        token=token,
        db=db,
    )

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
