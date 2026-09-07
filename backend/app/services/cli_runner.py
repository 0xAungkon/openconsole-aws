import os
import shlex
import shutil
import subprocess
import sys

from app.schemas.cli import CliResponse
from app.schemas.proxy import InlineCredentials


class CliError(Exception):
    """A user-facing CLI validation error (bad command, not allowed, etc.)."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _aws_binary() -> str:
    path = shutil.which("aws")
    if path:
        return path
    # Fall back to the venv's bin dir next to the running interpreter.
    candidate = os.path.join(os.path.dirname(sys.executable), "aws")
    if os.path.exists(candidate):
        return candidate
    raise CliError("AWS CLI is not installed on the server", status_code=500)


def run_cli(
    *,
    command: str,
    region: str,
    endpoint_url: str | None,
    credentials: InlineCredentials,
    timeout: int = 60,
) -> CliResponse:
    """Execute a single ``aws`` command with the given credentials.

    Only commands whose first token is ``aws`` are permitted — anything else is
    rejected. The command is parsed with ``shlex`` and run **without a shell**
    (``argv`` list), so shell metacharacters cannot inject additional commands.
    Credentials are injected via the environment (never argv) and are not logged.
    """
    try:
        tokens = shlex.split(command)
    except ValueError as exc:
        raise CliError(f"Could not parse command: {exc}") from exc

    if not tokens:
        raise CliError("Empty command")
    if tokens[0] != "aws":
        raise CliError("Only 'aws' commands are allowed in this terminal")

    args = tokens[1:]
    if not args:
        raise CliError("Provide an AWS CLI command, e.g. `aws s3 ls`")

    # Inject region/endpoint only when the user didn't specify them.
    if "--region" not in args:
        args = [*args, "--region", region]
    if endpoint_url and "--endpoint-url" not in args:
        args = [*args, "--endpoint-url", endpoint_url]

    argv = [_aws_binary(), *args]

    # A clean environment: only what the CLI needs, plus transient credentials.
    # AWS_CONFIG_FILE / AWS_SHARED_CREDENTIALS_FILE are pinned away from any
    # on-disk profile so the server's own environment can't leak in.
    env = {
        "PATH": os.environ.get("PATH", ""),
        "HOME": os.environ.get("HOME", "/tmp"),
        "LANG": os.environ.get("LANG", "C.UTF-8"),
        "AWS_ACCESS_KEY_ID": credentials.access_key_id,
        "AWS_SECRET_ACCESS_KEY": credentials.secret_access_key,
        "AWS_DEFAULT_REGION": region,
        "AWS_CONFIG_FILE": os.devnull,
        "AWS_SHARED_CREDENTIALS_FILE": os.devnull,
        "AWS_PAGER": "",
    }
    if credentials.session_token:
        env["AWS_SESSION_TOKEN"] = credentials.session_token

    try:
        proc = subprocess.run(
            argv,
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        raise CliError(
            f"Command timed out after {timeout}s", status_code=504
        ) from exc

    # Effective command for display — credentials live in env, not argv, so this
    # is safe to echo back to the client.
    display = "aws " + shlex.join(args)

    return CliResponse(
        ok=proc.returncode == 0,
        exit_code=proc.returncode,
        stdout=proc.stdout,
        stderr=proc.stderr,
        command=display,
    )
