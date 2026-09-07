import boto3
import pytest
from moto import mock_aws

GUEST_CREDS = {
    "access_key_id": "testing",
    "secret_access_key": "testing",
}


@mock_aws
def test_proxy_guest_list_buckets(client):
    # Seed a bucket in the mocked AWS account.
    boto3.client("s3", region_name="us-east-1").create_bucket(Bucket="my-bucket")

    r = client.post(
        "/api/proxy",
        json={
            "service": "s3",
            "operation": "list_buckets",
            "region": "us-east-1",
            "credentials": GUEST_CREDS,
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    names = [b["Name"] for b in body["result"]["Buckets"]]
    assert "my-bucket" in names
    # transport metadata is stripped
    assert "ResponseMetadata" not in body["result"]


@mock_aws
def test_proxy_unknown_operation(client):
    r = client.post(
        "/api/proxy",
        json={
            "service": "s3",
            "operation": "not_a_real_op",
            "region": "us-east-1",
            "credentials": GUEST_CREDS,
        },
    )
    assert r.status_code == 400
    body = r.json()
    assert body["ok"] is False
    assert body["error"]["code"] == "UnknownOperation"


@mock_aws
def test_proxy_client_error_surfaces_aws_code(client):
    # Deleting a non-existent bucket yields an AWS ClientError.
    r = client.post(
        "/api/proxy",
        json={
            "service": "s3",
            "operation": "delete_bucket",
            "region": "us-east-1",
            "params": {"Bucket": "does-not-exist-xyz"},
            "credentials": GUEST_CREDS,
        },
    )
    assert r.status_code == 400
    body = r.json()
    assert body["ok"] is False
    assert body["error"]["code"]  # a concrete AWS error code is present


def test_proxy_requires_credentials_or_profile(client):
    r = client.post(
        "/api/proxy",
        json={"service": "s3", "operation": "list_buckets", "region": "us-east-1"},
    )
    assert r.status_code == 400


@mock_aws
def test_proxy_register_mode_uses_stored_profile(client):
    # Register, store a profile, then proxy via profile_id (no inline creds).
    token = client.post(
        "/api/auth/register",
        json={"name": "P", "email": "p@example.com", "password": "supersecret"},
    ).json()["access_token"]
    auth = {"Authorization": f"Bearer {token}"}

    boto3.client("s3", region_name="us-east-1").create_bucket(Bucket="reg-bucket")

    cred = client.post(
        "/api/credentials",
        headers=auth,
        json={
            "label": "dev",
            "access_key_id": "testing",
            "secret_access_key": "testing",
            "default_region": "us-east-1",
        },
    ).json()

    r = client.post(
        "/api/proxy",
        headers=auth,
        json={
            "service": "s3",
            "operation": "list_buckets",
            "region": "us-east-1",
            "profile_id": cred["id"],
        },
    )
    assert r.status_code == 200, r.text
    names = [b["Name"] for b in r.json()["result"]["Buckets"]]
    assert "reg-bucket" in names
