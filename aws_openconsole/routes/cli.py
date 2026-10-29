from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session as DbSession

from aws_openconsole.database import get_db
from aws_openconsole.schemas.cli import CliRequest, CliResponse
from aws_openconsole.services import cli_runner
from aws_openconsole.services.cli_runner import CliError
from aws_openconsole.services.request_auth import resolve_credentials
from aws_openconsole.utils.security import oauth2_scheme

router = APIRouter(prefix="/api", tags=["cli"])


@router.post("/cli", response_model=CliResponse)
def cli(
    req: CliRequest,
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
        result = cli_runner.run_cli(
            command=req.command,
            region=req.region,
            endpoint_url=endpoint_url,
            credentials=credentials,
        )
    except CliError as exc:
        # Surface validation/allowlist errors as terminal stderr so the panel
        # can print them uniformly.
        return JSONResponse(
            status_code=exc.status_code,
            content=CliResponse(
                ok=False,
                exit_code=-1,
                stderr=exc.message,
                command=req.command,
            ).model_dump(),
        )

    return JSONResponse(content=result.model_dump())
