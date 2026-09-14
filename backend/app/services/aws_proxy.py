"""Generic boto3 dispatcher.

The frontend sends a raw AWS query (service + operation + params). We build a
boto3 client with the supplied credentials/region/endpoint and invoke the named
operation. This keeps the backend service-agnostic: supporting a new AWS service
or action is purely a frontend catalog change.

Security: credentials are used transiently to build the client and are never
persisted or logged here.
"""

import base64
import datetime as dt
from decimal import Decimal
from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import (
    BotoCoreError,
    ClientError,
    EndpointConnectionError,
    NoCredentialsError,
)
from botocore.response import StreamingBody

from app.schemas.proxy import InlineCredentials, ProxyError

# Short timeouts so a bad endpoint fails fast instead of hanging the request.
_BOTO_CONFIG = Config(
    connect_timeout=5, read_timeout=30, retries={"max_attempts": 2}
)


class ProxyExecutionError(Exception):
    """Raised when an AWS call fails in an expected, user-facing way."""

    def __init__(self, error: ProxyError, status_code: int = 400):
        self.error = error
        self.status_code = status_code
        super().__init__(error.message)


def _json_safe(value: Any) -> Any:
    """Coerce a boto3 response into JSON-serialisable primitives."""
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    if isinstance(value, (dt.datetime, dt.date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, StreamingBody):
        return value.read().decode("utf-8", errors="replace")
    if isinstance(value, (bytes, bytearray)):
        # e.g. Lambda invoke payloads — try text, fall back to base64.
        try:
            return value.decode("utf-8")
        except UnicodeDecodeError:
            return base64.b64encode(bytes(value)).decode("ascii")
    return value


# JSON can't carry raw bytes, so the frontend wraps binary values (e.g. an S3
# object body) as {"__bytes_base64__": "<base64>"}; we decode them here.
_BYTES_KEY = "__bytes_base64__"


def _decode_params(value: Any) -> Any:
    """Recursively replace {"__bytes_base64__": ...} markers with bytes."""
    if isinstance(value, dict):
        if set(value.keys()) == {_BYTES_KEY} and isinstance(value[_BYTES_KEY], str):
            try:
                return base64.b64decode(value[_BYTES_KEY], validate=True)
            except (ValueError, TypeError) as exc:
                raise ProxyExecutionError(
                    ProxyError(code="InvalidRequest", message=f"Invalid base64 body: {exc}"),
                    status_code=400,
                )
        return {k: _decode_params(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_decode_params(v) for v in value]
    return value


def run_query(
    *,
    service: str,
    operation: str,
    region: str,
    params: dict[str, Any] | None,
    endpoint_url: str | None,
    credentials: InlineCredentials,
) -> Any:
    """Execute a single AWS operation and return a JSON-safe result."""
    try:
        client = boto3.client(
            service,
            region_name=region,
            endpoint_url=endpoint_url or None,
            aws_access_key_id=credentials.access_key_id,
            aws_secret_access_key=credentials.secret_access_key,
            aws_session_token=credentials.session_token,
            config=_BOTO_CONFIG,
        )
    except Exception as exc:  # unknown service, bad region, etc.
        raise ProxyExecutionError(
            ProxyError(code="InvalidClient", message=str(exc)), status_code=400
        )

    method = getattr(client, operation, None)
    if method is None or not callable(method):
        raise ProxyExecutionError(
            ProxyError(
                code="UnknownOperation",
                message=f"'{operation}' is not a valid operation for service '{service}'",
            ),
            status_code=400,
        )

    try:
        raw = method(**_decode_params(params or {}))
    except ClientError as exc:
        err = exc.response.get("Error", {})
        raise ProxyExecutionError(
            ProxyError(
                code=err.get("Code", "ClientError"),
                message=err.get("Message", str(exc)),
            ),
            status_code=400,
        )
    except NoCredentialsError:
        raise ProxyExecutionError(
            ProxyError(code="NoCredentials", message="No credentials provided"),
            status_code=401,
        )
    except EndpointConnectionError as exc:
        raise ProxyExecutionError(
            ProxyError(code="EndpointConnectionError", message=str(exc)),
            status_code=502,
        )
    except (BotoCoreError, TypeError) as exc:
        # TypeError typically means bad/missing params for the operation.
        raise ProxyExecutionError(
            ProxyError(code="InvalidRequest", message=str(exc)), status_code=400
        )

    result = _json_safe(raw)
    # ResponseMetadata is transport noise; drop it from the payload we return.
    if isinstance(result, dict):
        result.pop("ResponseMetadata", None)
    return result
