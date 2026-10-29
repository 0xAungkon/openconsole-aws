import base64

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session as DbSession

from aws_openconsole.database import get_db
from aws_openconsole.schemas.proxy import (
    LambdaCodeRequest,
    LambdaCodeResponse,
    ProxyRequest,
    ProxyResponse,
)
from aws_openconsole.services import aws_proxy
from aws_openconsole.services.request_auth import resolve_credentials
from aws_openconsole.utils.security import oauth2_scheme

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


@router.post("/proxy/lambda-code", response_model=LambdaCodeResponse)
def lambda_code(
    req: LambdaCodeRequest,
    token: str | None = Depends(oauth2_scheme),
    db: DbSession = Depends(get_db),
) -> JSONResponse:
    """Return a Lambda function's deployment package as base64 (for the code editor)."""
    credentials, endpoint_url = resolve_credentials(
        credentials=req.credentials,
        profile_id=req.profile_id,
        endpoint_url=req.endpoint_url,
        token=token,
        db=db,
    )
    try:
        data = aws_proxy.fetch_lambda_package(
            function_name=req.function_name,
            region=req.region,
            endpoint_url=endpoint_url,
            credentials=credentials,
        )
    except aws_proxy.ProxyExecutionError as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content=LambdaCodeResponse(ok=False, error=exc.error).model_dump(),
        )
    return JSONResponse(
        content=LambdaCodeResponse(
            ok=True, zip_base64=base64.b64encode(data).decode("ascii"), size=len(data)
        ).model_dump()
    )
