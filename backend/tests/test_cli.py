import pytest

from app.schemas.proxy import InlineCredentials
from app.services import cli_runner
from app.services.cli_runner import CliError

GUEST_CREDS = {
    "access_key_id": "testing",
    "secret_access_key": "testing",
}
CREDS = InlineCredentials(access_key_id="testing", secret_access_key="testing")


def test_run_cli_rejects_non_aws_command():
    with pytest.raises(CliError) as exc:
        cli_runner.run_cli(
            command="rm -rf /",
            region="us-east-1",
            endpoint_url=None,
            credentials=CREDS,
        )
    assert "only 'aws'" in str(exc.value).lower()


def test_run_cli_rejects_empty_command():
    with pytest.raises(CliError):
        cli_runner.run_cli(
            command="   ",
            region="us-east-1",
            endpoint_url=None,
            credentials=CREDS,
        )


def test_run_cli_rejects_bare_aws():
    with pytest.raises(CliError):
        cli_runner.run_cli(
            command="aws",
            region="us-east-1",
            endpoint_url=None,
            credentials=CREDS,
        )


def test_cli_route_rejects_non_aws(client):
    """A non-aws command is rejected at the route with a 400 and stderr set —
    no subprocess is spawned, so this needs no AWS access."""
    r = client.post(
        "/api/cli",
        json={
            "command": "curl http://evil",
            "region": "us-east-1",
            "credentials": GUEST_CREDS,
        },
    )
    assert r.status_code == 400, r.text
    body = r.json()
    assert body["ok"] is False
    assert "aws" in body["stderr"].lower()


def test_cli_route_requires_credentials_or_profile(client):
    r = client.post("/api/cli", json={"command": "aws s3 ls", "region": "us-east-1"})
    assert r.status_code == 400, r.text
